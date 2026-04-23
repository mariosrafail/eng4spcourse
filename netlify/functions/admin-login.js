import { badRequest, json, unauthorized } from "./_lib/http.js";
import { createSession, findUserByUsername, hashPassword } from "./_lib/auth.js";
import { ADMIN_USERNAME, ensureAdminUser } from "./_lib/admin.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    await ensureAdminUser();

    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) return badRequest("Username and password are required.");

    const user = await findUserByUsername(username);
    if (!user) return unauthorized("Invalid credentials.");
    if (String(user.username || "").trim().toLowerCase() !== ADMIN_USERNAME.toLowerCase()) {
      return json(403, { error: "Admin access only." });
    }

    const checkHash = hashPassword(password, user.password_salt);
    if (checkHash !== user.password_hash) return unauthorized("Invalid credentials.");

    const session = await createSession(user.id);
    return json(200, {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
