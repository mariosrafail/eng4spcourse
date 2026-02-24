import { badRequest, json } from "./_lib/http.js";
import { createSession, normalizeEmail } from "./_lib/auth.js";
import { ensureSchema, getPool } from "./_lib/db.js";
import { REGISTER_CODE_MAX_ATTEMPTS, hashVerificationCode } from "./_lib/verification.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const code = String(body?.code || "").trim();

    if (!email || !code) {
      return badRequest("Email and verification code are required.");
    }
    if (!/^\d{6}$/.test(code)) {
      return badRequest("Verification code must be 6 digits.");
    }

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT email, password_salt, password_hash, code_hash, expires_at, attempts
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );

    if (!rows.length) {
      return badRequest("No pending verification for this email.");
    }

    const pending = rows[0];
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await getPool().query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]);
      return badRequest("Verification code expired. Request a new one.");
    }

    const incomingCodeHash = hashVerificationCode(code);
    if (incomingCodeHash !== pending.code_hash) {
      const nextAttempts = Number(pending.attempts || 0) + 1;
      if (nextAttempts >= REGISTER_CODE_MAX_ATTEMPTS) {
        await getPool().query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]);
        return badRequest("Too many failed attempts. Request a new code.");
      }
      await getPool().query(
        `UPDATE email_verification_codes SET attempts = $2 WHERE email = $1`,
        [email, nextAttempts]
      );
      return badRequest("Invalid verification code.");
    }

    const client = await getPool().connect();
    let userId;
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO users (email, username, password_salt, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [pending.email, pending.email, pending.password_salt, pending.password_hash]
      );
      userId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO user_progress (user_id, progress) VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      await client.query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") {
        return badRequest("Email already exists.");
      }
      throw error;
    } finally {
      client.release();
    }

    const session = await createSession(userId);
    return json(201, {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: userId, email, progress: 0 }
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
