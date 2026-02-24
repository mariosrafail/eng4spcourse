const crypto = require("crypto");

const emails = [
  "test1@example.com",
  "test2@example.com",
  "test3@example.com",
  "test4@example.com",
  "test5@example.com"
];
const password = "tfAEBcnA1!";

function makePair(p) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(p, salt, 64).toString("hex");
  return { salt, hash };
}

const pairs = emails.map(() => makePair(password));
console.log("PASSWORD=" + password);
console.log("EMAILS=" + emails.join(","));
console.log("\n-- SQL");

emails.forEach((email, i) => {
  const { salt, hash } = pairs[i];
  console.log(
    `UPDATE users SET password_salt='${salt}', password_hash='${hash}' WHERE email='${email}';`
  );
});
