import os
import hashlib

emails = [
    "test1@example.com",
    "test2@example.com",
    "test3@example.com",
    "test4@example.com",
    "test5@example.com",
]
password = "tfAEBcnA1!"

print("PASSWORD=" + password)
print("EMAILS=" + ",".join(emails))
print("\n-- SQL")

for email in emails:
    salt = os.urandom(16).hex()
    hashed = hashlib.scrypt(
        password.encode(),
        salt=bytes.fromhex(salt),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    print(
        "INSERT INTO users (email, username, password_salt, password_hash) "
        "VALUES ('%s', '%s', '%s', '%s');" % (email, email, salt, hashed)
    )
    print(
        "INSERT INTO user_progress (user_id, progress) "
        "VALUES ((SELECT id FROM users WHERE email='%s'), 0) "
        "ON CONFLICT (user_id) DO NOTHING;" % email
    )
