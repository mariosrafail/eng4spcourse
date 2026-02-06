import { ensureSchema, getPool } from "./_lib/db.js";
import { badRequest, json } from "./_lib/http.js";
import { createSession, makePasswordPair, validateCredentials } from "./_lib/auth.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json();
    const { email, username, password } = body || {};
    const valid = validateCredentials({ email, username, password });
    if (!valid.ok) return badRequest(valid.error);

    await ensureSchema();
    const pool = getPool();
    const client = await pool.connect();

    let userId;
    try {
      await client.query("BEGIN");
      const pass = makePasswordPair(password);
      const inserted = await client.query(
        `INSERT INTO users (email, username, password_salt, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [valid.email, valid.username, pass.salt, pass.hash]
      );
      userId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO user_progress (user_id, progress) VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") {
        return badRequest("Email or username already exists.");
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
      user: { id: userId, email: valid.email, username: valid.username, progress: 0 }
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
