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
    const resetAll = !!body?.resetAll;
    const overrideKey = String(body?.overrideKey || "").trim();

    await ensureSchema();

    if (resetAll) {
      await getPool().query(`DELETE FROM global_tab_timer_overrides`);
      return json(200, { ok: true, resetAll: true });
    }

    if (!overrideKey) {
      return badRequest("overrideKey is required unless resetAll is true.");
    }

    await getPool().query(
      `DELETE FROM global_tab_timer_overrides WHERE override_key = $1`,
      [overrideKey]
    );

    return json(200, { ok: true, overrideKey });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};