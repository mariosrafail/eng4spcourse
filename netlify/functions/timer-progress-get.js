import { json, unauthorized } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, getPool } from "./_lib/db.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req);
    if (!auth) return unauthorized();

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT module_id, tab_key, duration_ms, remaining_ms, completed, completed_at, updated_at
       FROM user_tab_timer_progress
       WHERE user_id = $1
       ORDER BY module_id ASC, tab_key ASC`,
      [auth.user.id]
    );

    const entries = rows.map((row) => ({
      moduleId: String(row.module_id || ""),
      tabKey: String(row.tab_key || ""),
      durationMs: Number(row.duration_ms) || 0,
      remainingMs: Number(row.remaining_ms) || 0,
      completed: !!row.completed,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : 0,
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0
    }));

    return json(200, { ok: true, entries });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};