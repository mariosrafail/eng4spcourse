import { json, unauthorized } from "./_lib/http.js";
import { ensureSchema, getPool } from "./_lib/db.js";
import { ADMIN_USERNAME, requireAdmin } from "./_lib/admin.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth) return unauthorized();

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.email, COALESCE(p.progress, 0) AS progress
       FROM users u
       LEFT JOIN user_progress p ON p.user_id = u.id
       WHERE LOWER(u.username) <> $1
       ORDER BY u.created_at ASC`,
      [ADMIN_USERNAME.toLowerCase()]
    );

    const candidates = rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username || ""),
      email: String(row.email || ""),
      progress: Math.max(0, Math.min(100, Number(row.progress) || 0))
    }));

    return json(200, { ok: true, candidates });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
