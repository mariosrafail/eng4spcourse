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
    const progress = Number(body?.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      return badRequest("progress must be a number between 0 and 100.");
    }

    const rounded = Math.round(progress);
    await ensureSchema();
    await getPool().query(
      `INSERT INTO user_progress (user_id, progress, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET progress = EXCLUDED.progress, updated_at = NOW()`,
      [auth.user.id, rounded]
    );

    return json(200, { ok: true, progress: rounded, completed: rounded === 100 });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
