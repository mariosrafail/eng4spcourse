import "dotenv/config";
import crypto from "crypto";
import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const HOST = "127.0.0.1";
const PORT = 8000;
const SESSION_DAYS = 30;
const REGISTER_CODE_MINUTES = 10;
const REGISTER_CODE_MAX_ATTEMPTS = 5;
const CAPTCHA_TTL_MINUTES = 5;
const CAPTCHA_MAX_ATTEMPTS = 5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIZ_ANSWERS = {
  module1_useful_language: { m1q1: "a", m1q2: "a", m1q3: "a", m1q4: "a", m1q5: "a" },
  module1_listening: { lq1: "b", lq2: "b", lq3: "b" },
  module1_reading: { r1: "b", r2: "a", r3: "a" },
  module1_h2_listening: { h2lq1: "a", h2lq2: "c", h2lq3: "a" },
  module1_h2_reading: { h2r1: "b", h2r2: "a", h2r3: "c" },
  module2_useful_language: { q1: "a", q2: "a", q3: "a" },
  module2_listening: { lq1: "b", lq2: "a", lq3: "b" },
  module2_h2_listening: { h2lq1: "b", h2lq2: "c", h2lq3: "a" },
  module2_reading: { r1: "c", r2: "c", r3: "c" },
  module2_h2_reading: { h2r1: "a", h2r2: "b", h2r3: "a" },
  module3_keywords_listening: { m3kq1: "b", m3kq2: "a", m3kq3: "c" },
  mini_mock_listening_1a: { mq1: "b", mq2: "c" },
  mini_mock_listening_1b: { mq3: "a", mq4: "b", mq5: "c" },
  mini_mock_reading_1: { mqr1: "b", mqr2: "a", mqr3: "b", mqr4: "b" },
  mini_mock_reading_2: { mqrb5: "a", mqrb6: "c", mqrb7: "b", mqrb8: "a" }
};

const DND_ANSWERS = {
  module1_practice: ["are", "in", "like", "prefer", "she", "this", "glad"],
  module1_speaking: ["d", "f", "a", "b", "c", "e"],
  module1_h2_keywords: ["F", "C", "E", "A", "D", "B"],
  module1_h2_writing_task1: ["flight", "visit", "island", "travel", "ferry"],
  module3_activity2: ["C", "F", "A", "D", "E", "B"],
  module2_practice: ["doesn't like", "she", "likes", "do", "flies"],
  module2_speaking: ["c", "d", "b", "f", "a", "e"],
  module2_h2_keywords: ["E", "C", "B", "D", "F", "A"],
  module2_h2_writing_task1: ["rates", "reservations", "beginning", "prices"],
  mini_mock_writing_1: ["manners", "warm", "respect", "team"]
};

let pool;
let schemaReady = false;
let mailTransporter;
const captchaChallenges = new Map();

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL or NEON_DATABASE_URL environment variable.");
  }
  return url;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureSchema() {
  if (schemaReady) return;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        progress NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE user_progress
      ALTER COLUMN progress TYPE NUMERIC(7,4) USING progress::NUMERIC,
      ALTER COLUMN progress SET DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE user_progress
      DROP CONSTRAINT IF EXISTS user_progress_progress_check;
    `);
    await client.query(`
      ALTER TABLE user_progress
      ADD CONSTRAINT user_progress_progress_check
      CHECK (progress >= 0 AND progress <= 100);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        email TEXT PRIMARY KEY,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query("COMMIT");
    schemaReady = true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, saltHex) {
  return crypto.scryptSync(password, saltHex, 64).toString("hex");
}

function makePasswordPair(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function createVerificationCode() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}

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

function createCaptchaChallenge() {
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

function verifyCaptchaChallenge(challengeId, answer) {
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

function validateCredentials({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, error: "Invalid email." };
  }
  if (!password || String(password).length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  return { ok: true, email: normalizedEmail };
}

function getMailFrom() {
  const from = process.env.MAIL_FROM || "";
  if (!from) {
    throw new Error("Missing MAIL_FROM.");
  }
  return from;
}

function getMailConfig() {
  const from = getMailFrom();
  const host = process.env.MAIL_HOST || "127.0.0.1";
  const port = Number(process.env.MAIL_PORT || 587);
  const secure = String(process.env.MAIL_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = process.env.MAIL_USER || "";
  const pass = process.env.MAIL_PASS || "";
  return { from, host, port, secure, user, pass };
}

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  const config = getMailConfig();
  const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined;
  mailTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth
  });
  return mailTransporter;
}

async function sendVerificationEmail(email, code) {
  const mailConfig = getMailConfig();
  await getMailTransporter().sendMail({
    from: mailConfig.from,
    to: email,
    subject: "Your verification code",
    text: `Your verification code is: ${code}. It expires in ${REGISTER_CODE_MINUTES} minutes.`,
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>It expires in ${REGISTER_CODE_MINUTES} minutes.</p>`
  });
}

async function createSession(userId) {
  await ensureSchema();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    `INSERT INTO user_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, userId, expiresAt.toISOString()]
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

async function getUserFromToken(token) {
  if (!token) return null;
  await ensureSchema();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await getPool().query(
    `SELECT u.id, u.email, s.expires_at
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [tokenHash]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await getPool().query(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash]);
    return null;
  }
  return {
    tokenHash,
    user: {
      id: row.id,
      email: row.email
    }
  };
}

async function requireUser(req) {
  return getUserFromToken(getBearerToken(req));
}

async function findUserByEmail(email) {
  await ensureSchema();
  const normalizedEmail = normalizeEmail(email);
  const { rows } = await getPool().query(
    `SELECT id, email, password_salt, password_hash
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );
  return rows[0] || null;
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.post("/api/check-quiz", (req, res) => {
  const quizId = req.body?.quizId;
  const submitted = req.body?.answers;

  if (typeof quizId !== "string" || typeof submitted !== "object" || submitted === null || Array.isArray(submitted)) {
    return res.status(400).json({ error: "Expected quizId (string) and answers (object)" });
  }

  const expected = QUIZ_ANSWERS[quizId];
  if (!expected) {
    return res.status(404).json({ error: "Unknown quizId" });
  }

  let wrongCount = 0;
  const correctByQuestion = {};
  Object.entries(expected).forEach(([qid, correctValue]) => {
    const ok = submitted[qid] === correctValue;
    correctByQuestion[qid] = ok;
    if (!ok) wrongCount += 1;
  });

  return res.status(200).json({
    quizId,
    allCorrect: wrongCount === 0,
    wrongCount,
    total: Object.keys(expected).length,
    correctByQuestion
  });
});

app.post("/api/check-dnd", (req, res) => {
  const exerciseId = req.body?.exerciseId;
  const submitted = req.body?.answers;

  if (typeof exerciseId !== "string" || !Array.isArray(submitted)) {
    return res.status(400).json({ error: "Expected exerciseId (string) and answers (array)" });
  }

  const expected = DND_ANSWERS[exerciseId];
  if (!expected) {
    return res.status(404).json({ error: "Unknown exerciseId" });
  }
  if (submitted.length !== expected.length) {
    return res.status(400).json({ error: "Answers length mismatch" });
  }

  let wrongCount = 0;
  const correctByIndex = expected.map((correctValue, i) => {
    const ok = submitted[i] === correctValue;
    if (!ok) wrongCount += 1;
    return ok;
  });

  return res.status(200).json({
    exerciseId,
    allCorrect: wrongCount === 0,
    wrongCount,
    total: expected.length,
    correctByIndex
  });
});

app.get("/api/auth/captcha-challenge", (_req, res) => {
  try {
    const challenge = createCaptchaChallenge();
    return res.status(200).json({ ok: true, ...challenge });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, captchaId, captchaAnswer } = req.body || {};
    const valid = validateCredentials({ email, password });
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    const captchaCheck = verifyCaptchaChallenge(captchaId, captchaAnswer);
    if (!captchaCheck.ok) return res.status(400).json({ error: captchaCheck.error });

    await ensureSchema();
    const existing = await findUserByEmail(valid.email);
    if (existing) return res.status(400).json({ error: "Email already exists." });

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
        [valid.email, pass.salt, pass.hash, codeHash, expiresAt]
      );
      await sendVerificationEmail(valid.email, code);
    } catch (error) {
      await getPool().query(`DELETE FROM email_verification_codes WHERE email = $1`, [valid.email]).catch(() => {});
      return res.status(502).json({ error: `Email sending failed: ${error?.message || "mail transport error"}` });
    }

    return res.status(200).json({
      ok: true,
      verificationRequired: true,
      email: valid.email,
      expiresInMinutes: REGISTER_CODE_MINUTES
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.post("/api/auth/register-verify", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ error: "Email and verification code are required." });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Verification code must be 6 digits." });
    }

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT email, password_salt, password_hash, code_hash, expires_at, attempts
       FROM email_verification_codes
       WHERE email = $1`,
      [email]
    );
    if (!rows.length) {
      return res.status(400).json({ error: "No pending verification for this email." });
    }

    const pending = rows[0];
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await getPool().query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]);
      return res.status(400).json({ error: "Verification code expired. Request a new one." });
    }

    const incomingCodeHash = hashVerificationCode(code);
    if (incomingCodeHash !== pending.code_hash) {
      const nextAttempts = Number(pending.attempts || 0) + 1;
      if (nextAttempts >= REGISTER_CODE_MAX_ATTEMPTS) {
        await getPool().query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]);
        return res.status(400).json({ error: "Too many failed attempts. Request a new code." });
      }
      await getPool().query(
        `UPDATE email_verification_codes SET attempts = $2 WHERE email = $1`,
        [email, nextAttempts]
      );
      return res.status(400).json({ error: "Invalid verification code." });
    }

    const client = await getPool().connect();
    let userId;
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO users (email, username, password_salt, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [pending.email, pending.email, pending.password_salt, pending.password_hash]
      );
      userId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO user_progress (user_id, progress) VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      await client.query(`DELETE FROM email_verification_codes WHERE email = $1`, [email]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") {
        return res.status(400).json({ error: "Email already exists." });
      }
      throw error;
    } finally {
      client.release();
    }

    const session = await createSession(userId);
    return res.status(201).json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: userId, email, progress: 0 }
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const checkHash = hashPassword(password, user.password_salt);
    if (checkHash !== user.password_hash) return res.status(401).json({ error: "Invalid credentials." });

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT progress FROM user_progress WHERE user_id = $1`,
      [user.id]
    );
    const progress = rows.length ? Number(rows[0].progress) : 0;

    const session = await createSession(user.id);
    return res.status(200).json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        progress
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const auth = await requireUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT progress FROM user_progress WHERE user_id = $1`,
      [auth.user.id]
    );

    return res.status(200).json({
      ok: true,
      user: {
        ...auth.user,
        progress: rows.length ? Number(rows[0].progress) : 0
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(200).json({ ok: true });
    await ensureSchema();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await getPool().query(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash]);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.get("/api/progress-get", async (req, res) => {
  try {
    const auth = await requireUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT progress FROM user_progress WHERE user_id = $1`,
      [auth.user.id]
    );
    return res.status(200).json({ ok: true, progress: rows.length ? Number(rows[0].progress) : 0 });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.post("/api/progress-set", async (req, res) => {
  try {
    const auth = await requireUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    const progress = Number(req.body?.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      return res.status(400).json({ error: "progress must be a number between 0 and 100." });
    }
    const normalized = Math.round(progress * 10000) / 10000;
    await ensureSchema();
    await getPool().query(
      `INSERT INTO user_progress (user_id, progress, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET progress = EXCLUDED.progress, updated_at = NOW()`,
      [auth.user.id, normalized]
    );
    return res.status(200).json({ ok: true, progress: normalized, completed: normalized >= 100 });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
});

app.use(express.static(__dirname, { index: "index.html" }));

app.listen(PORT, HOST, () => {
  console.log(`Server started on http://${HOST}:${PORT}`);
});
