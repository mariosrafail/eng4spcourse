import { json, unauthorized } from "./_lib/http.js";
import { ensureSchema, getPool } from "./_lib/db.js";
import { requireUser } from "./_lib/auth.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req);
    if (!auth) return unauthorized();

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT progress FROM user_progress WHERE user_id = $1`,
      [auth.user.id]
    );

    return json(200, {
      ok: true,
      user: {
        ...auth.user,
        progress: rows.length ? rows[0].progress : 0
      }
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
