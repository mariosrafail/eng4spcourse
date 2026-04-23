import { json, unauthorized } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth) return unauthorized();

    return json(200, {
      ok: true,
      user: {
        id: auth.user.id,
        username: auth.user.username,
        email: auth.user.email
      }
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
