import { ensureSchema, getPool } from "./db.js";
import { makePasswordPair, requireUser } from "./auth.js";

export const ADMIN_USERNAME = "admin123";
export const ADMIN_PASSWORD = "admin123";
export const ADMIN_EMAIL = "admin123@admin.local";

export async function ensureAdminUser() {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const passwordPair = makePasswordPair(ADMIN_PASSWORD);
    const byUsername = await client.query(
      `SELECT id FROM users WHERE LOWER(username) = $1`,
      [ADMIN_USERNAME.toLowerCase()]
    );
    if (byUsername.rows.length) {
      await client.query(
        `UPDATE users
         SET password_salt = $2, password_hash = $3
         WHERE id = $1`,
        [byUsername.rows[0].id, passwordPair.salt, passwordPair.hash]
      );
      await client.query("COMMIT");
      return;
    }

    const byEmail = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [ADMIN_EMAIL.toLowerCase()]
    );
    if (byEmail.rows.length) {
      await client.query(
        `UPDATE users
         SET username = $2, password_salt = $3, password_hash = $4
         WHERE id = $1`,
        [byEmail.rows[0].id, ADMIN_USERNAME, passwordPair.salt, passwordPair.hash]
      );
      await client.query("COMMIT");
      return;
    }

    await client.query(
      `INSERT INTO users (email, username, password_salt, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [ADMIN_EMAIL, ADMIN_USERNAME, passwordPair.salt, passwordPair.hash]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function requireAdmin(req) {
  const auth = await requireUser(req);
  if (!auth) return null;
  const username = String(auth.user?.username || "").trim().toLowerCase();
  if (username !== ADMIN_USERNAME.toLowerCase()) return null;
  return auth;
}
