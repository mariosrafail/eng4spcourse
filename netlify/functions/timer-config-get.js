import { json } from "./_lib/http.js";
import { ensureSchema, getPool } from "./_lib/db.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT override_key, minutes
       FROM global_tab_timer_overrides
       ORDER BY override_key ASC`
    );

    const overrides = Object.fromEntries(
      rows.map((row) => [String(row.override_key || ""), Number(row.minutes) || 0])
    );

    return json(200, { ok: true, overrides });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};