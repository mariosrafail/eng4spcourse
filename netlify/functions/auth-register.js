import { ensureSchema, getPool } from "./_lib/db.js";
import { badRequest, json } from "./_lib/http.js";
import { findUserByEmail, makePasswordPair, normalizeEmail } from "./_lib/auth.js";
import { verifyCaptchaChallenge } from "./_lib/captcha.js";
import { sendVerificationEmail } from "./_lib/mail.js";
import {
  REGISTER_CODE_MINUTES,
  createVerificationCode,
  hashVerificationCode
} from "./_lib/verification.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || "");
    const captchaId = body?.captchaId;
    const captchaAnswer = body?.captchaAnswer;

    if (!email || !email.includes("@")) return badRequest("Invalid email.");
    if (!password || password.length < 8) return badRequest("Password must be at least 8 characters.");

    const captchaCheck = verifyCaptchaChallenge(captchaId, captchaAnswer);
    if (!captchaCheck.ok) return badRequest(captchaCheck.error);

    await ensureSchema();
    const existing = await findUserByEmail(email);
    if (existing) return badRequest("Email already exists.");

    const pass = makePasswordPair(password);
    const code = createVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + REGISTER_CODE_MINUTES * 60 * 1000).toISOString();

    try {
      await getPool().query(
        `INSERT INTO email_verification_codes (email, password_salt, password_hash, code_hash, expires_at, attempts)
         VALUES ($1, $2, $3, $4, $5, 0)
         ON CONFLICT (email)
         DO UPDATE SET
           password_salt = EXCLUDED.password_salt,
           password_hash = EXCLUDED.password_hash,
           code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           created_at = NOW()`,
        [email, pass.salt, pass.hash, codeHash, expiresAt]
      );
      await sendVerificationEmail(email, code, REGISTER_CODE_MINUTES);
    } catch (error) {
      await getPool().query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]).catch(() => {});
      return json(502, { error: `Email sending failed: ${error?.message || "mail transport error"}` });
    }

    return json(200, {
      ok: true,
      verificationRequired: true,
      email,
      expiresInMinutes: REGISTER_CODE_MINUTES
    });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
