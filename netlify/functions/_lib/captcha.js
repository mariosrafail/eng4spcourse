import crypto from "crypto";

const CAPTCHA_TTL_MINUTES = 5;
const CAPTCHA_MAX_ATTEMPTS = 5;
const captchaChallenges = new Map();

function normalizeCaptchaAnswer(answer) {
  return String(answer || "").trim().toLowerCase().replace(/\s+/g, "");
}

function hashCaptchaAnswer(answer) {
  return crypto.createHash("sha256").update(normalizeCaptchaAnswer(answer)).digest("hex");
}

function cleanupCaptchaChallenges() {
  const now = Date.now();
  for (const [id, value] of captchaChallenges.entries()) {
    if (!value || value.expiresAt <= now) {
      captchaChallenges.delete(id);
    }
  }
}

export function createCaptchaChallenge() {
  cleanupCaptchaChallenges();
  const left = crypto.randomInt(2, 12);
  const right = crypto.randomInt(2, 12);
  const useMinus = crypto.randomInt(0, 2) === 1;
  const a = useMinus ? Math.max(left, right) : left;
  const b = useMinus ? Math.min(left, right) : right;
  const answer = useMinus ? String(a - b) : String(a + b);
  const prompt = useMinus ? `What is ${a} - ${b}?` : `What is ${a} + ${b}?`;
  const challengeId = crypto.randomBytes(18).toString("hex");

  captchaChallenges.set(challengeId, {
    answerHash: hashCaptchaAnswer(answer),
    attempts: 0,
    expiresAt: Date.now() + CAPTCHA_TTL_MINUTES * 60 * 1000
  });

  return { challengeId, prompt, expiresInMinutes: CAPTCHA_TTL_MINUTES };
}

export function verifyCaptchaChallenge(challengeId, answer) {
  cleanupCaptchaChallenges();
  const id = String(challengeId || "").trim();
  const normalizedAnswer = normalizeCaptchaAnswer(answer);

  if (!id || !normalizedAnswer) {
    return { ok: false, error: "Captcha is required." };
  }

  const challenge = captchaChallenges.get(id);
  if (!challenge) {
    return { ok: false, error: "Captcha expired. Press Refresh and try again." };
  }

  if (challenge.expiresAt <= Date.now()) {
    captchaChallenges.delete(id);
    return { ok: false, error: "Captcha expired. Press Refresh and try again." };
  }

  const incomingHash = hashCaptchaAnswer(normalizedAnswer);
  if (incomingHash !== challenge.answerHash) {
    challenge.attempts += 1;
    if (challenge.attempts >= CAPTCHA_MAX_ATTEMPTS) {
      captchaChallenges.delete(id);
      return { ok: false, error: "Too many failed captcha attempts. Refresh and try again." };
    }
    captchaChallenges.set(id, challenge);
    return { ok: false, error: "Invalid captcha answer." };
  }

  captchaChallenges.delete(id);
  return { ok: true };
}
