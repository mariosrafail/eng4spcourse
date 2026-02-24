import { json } from "./_lib/http.js";
import { createCaptchaChallenge } from "./_lib/captcha.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const challenge = createCaptchaChallenge();
    return json(200, { ok: true, ...challenge });
  } catch (error) {
    return json(500, { error: error?.message || "Internal error" });
  }
};
