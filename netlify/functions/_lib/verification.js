import crypto from "crypto";

export const REGISTER_CODE_MINUTES = 10;
export const REGISTER_CODE_MAX_ATTEMPTS = 5;

export function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export function createVerificationCode() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}
