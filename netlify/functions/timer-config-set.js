import { badRequest, json, unauthorized } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";
import { ensureSchema, getPool } from "./_lib/db.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const overrideKey = String(body?.overrideKey || "").trim();
    const minutes = Number(body?.minutes);

    if (!overrideKey) {
      return badRequest("overrideKey is required.");
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return badRequest("minutes must be a positive number.");
    }

    const roundedMinutes = Math.max(1, Math.round(minutes));

    await ensureSchema();
    await getPool().query(
      `INSERT INTO global_tab_timer_overrides (override_key, minutes, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (override_key)
       DO UPDATE SET minutes = EXCLUDED.minutes, updated_at = NOW()`,
      [overrideKey, roundedMinutes]
    );

    return json(200, { ok: true, overrideKey, minutes: roundedMinutes });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};