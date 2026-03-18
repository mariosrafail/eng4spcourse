import { badRequest, json, unauthorized } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, getPool } from "./_lib/db.js";

function normalizeEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];

  return rawEntries
    .map((entry) => {
      const moduleId = String(entry?.moduleId || "").trim();
      const tabKey = String(entry?.tabKey || "").trim();
      const durationMs = Math.max(0, Math.round(Number(entry?.durationMs) || 0));
      const remainingMs = Math.max(0, Math.round(Number(entry?.remainingMs) || 0));
      const completed = !!entry?.completed || remainingMs <= 0;
      const completedAt = Number(entry?.completedAt) || 0;

      if (!moduleId || !tabKey) return null;

      return {
        moduleId,
        tabKey,
        durationMs,
        remainingMs: completed ? 0 : remainingMs,
        completed,
        completedAt: completedAt > 0 ? new Date(completedAt).toISOString() : null
      };
    })
    .filter(Boolean);
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const entries = normalizeEntries(body?.entries);
    if (!entries.length) {
      return badRequest("entries must be a non-empty array.");
    }

    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      for (const entry of entries) {
        await client.query(
          `INSERT INTO user_tab_timer_progress (
             user_id,
             module_id,
             tab_key,
             duration_ms,
             remaining_ms,
             completed,
             completed_at,
             updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (user_id, module_id, tab_key)
           DO UPDATE SET
             duration_ms = EXCLUDED.duration_ms,
             remaining_ms = EXCLUDED.remaining_ms,
             completed = EXCLUDED.completed,
             completed_at = EXCLUDED.completed_at,
             updated_at = NOW()`,
          [
            auth.user.id,
            entry.moduleId,
            entry.tabKey,
            entry.durationMs,
            entry.remainingMs,
            entry.completed,
            entry.completedAt
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return json(200, { ok: true, count: entries.length });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};