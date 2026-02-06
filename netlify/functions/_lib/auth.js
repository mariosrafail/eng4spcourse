import crypto from "crypto";
import { ensureSchema, getPool } from "./db.js";

const SESSION_DAYS = 30;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeUsername(username) {
  return String(username || "").trim();
}

export function hashPassword(password, saltHex) {
  return crypto.scryptSync(password, saltHex, 64).toString("hex");
}

export function makePasswordPair(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

export async function createSession(userId) {
  await ensureSchema();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    `INSERT INTO user_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, userId, expiresAt.toISOString()]
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

export function getBearerToken(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

export async function getUserFromToken(token) {
  if (!token) return null;
  await ensureSchema();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await getPool().query(
    `SELECT u.id, u.email, u.username, s.expires_at
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [tokenHash]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await getPool().query(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash]);
    return null;
  }
  return {
    tokenHash,
    user: {
      id: row.id,
      email: row.email,
      username: row.username
    }
  };
}

export async function requireUser(req) {
  const token = getBearerToken(req);
  return getUserFromToken(token);
}

export function validateCredentials({ email, username, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, error: "Invalid email." };
  }
  if (!normalizedUsername || normalizedUsername.length < 3 || normalizedUsername.length > 40) {
    return { ok: false, error: "Username must be 3-40 characters." };
  }
  if (!password || String(password).length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  return { ok: true, email: normalizedEmail, username: normalizedUsername };
}

export async function findUserByEmail(email) {
  await ensureSchema();
  const normalizedEmail = normalizeEmail(email);
  const { rows } = await getPool().query(
    `SELECT id, email, username, password_salt, password_hash
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );
  return rows[0] || null;
}
