import { badRequest, json, unauthorized } from "./_lib/http.js";
import { createSession, findUserByEmail, hashPassword } from "./_lib/auth.js";
import { ensureSchema, getPool } from "./_lib/db.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email || !password) return badRequest("Email and password are required.");

    const user = await findUserByEmail(email);
    if (!user) return unauthorized("Invalid credentials.");

    const checkHash = hashPassword(password, user.password_salt);
    if (checkHash !== user.password_hash) return unauthorized("Invalid credentials.");

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT progress FROM user_progress WHERE user_id = $1`,
      [user.id]
    );
    const progress = rows.length ? rows[0].progress : 0;

    const session = await createSession(user.id);
    return json(200, {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        progress
      }
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
