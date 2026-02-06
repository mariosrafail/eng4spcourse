import crypto from "crypto";
import { json } from "./_lib/http.js";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getBearerToken } from "./_lib/auth.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return json(200, { ok: true });

    await ensureSchema();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await getPool().query(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash]);

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
