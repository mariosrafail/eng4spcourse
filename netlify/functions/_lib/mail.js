import nodemailer from "nodemailer";

let mailTransporter;

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

export async function sendVerificationEmail(email, code, expiresInMinutes) {
  const mailConfig = getMailConfig();
  await getMailTransporter().sendMail({
    from: mailConfig.from,
    to: email,
    subject: "Your verification code",
    text: `Your verification code is: ${code}. It expires in ${expiresInMinutes} minutes.`,
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>It expires in ${expiresInMinutes} minutes.</p>`
  });
}
