import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../shared/routes";
import { decryptSensitive, encryptSensitive, generateOpaqueToken, generateOtp, hashToken, sanitizeUser, tokenMatches } from "../server/security";

process.env.DATA_ENCRYPTION_KEY = "test-only-encryption-key-never-use-in-production";

test("opaque security tokens are random and verifiable by hash", () => {
  const first = generateOpaqueToken();
  const second = generateOpaqueToken();
  assert.notEqual(first, second);
  assert.equal(tokenMatches(first, hashToken(first)), true);
  assert.equal(tokenMatches(second, hashToken(first)), false);
});

test("OTP codes contain exactly six digits", () => {
  for (let index = 0; index < 20; index += 1) assert.match(generateOtp(), /^\d{6}$/);
});

test("sensitive fields are encrypted with authenticated encryption", () => {
  const encrypted = encryptSensitive("1234");
  assert.notEqual(encrypted, "1234");
  assert.equal(decryptSensitive(encrypted), "1234");
  assert.throws(() => decryptSensitive(`${encrypted}tampered`));
});

test("API user output removes password and SSN values", () => {
  const safe = sanitizeUser({ id: 1, password: "secret", ssnLast4: "1234", ssnLast4Encrypted: "cipher", email: "member@example.com" });
  assert.equal("password" in safe, false);
  assert.equal("ssnLast4" in safe, false);
  assert.equal("ssnLast4Encrypted" in safe, false);
  assert.equal(safe.ssnMasked, "***-**-****");
});

test("registration rejects privilege escalation and weak passwords", () => {
  const base = { fullName: "Test Member", email: "member@example.com", password: "StrongPass1", ssnLast4: "1234" };
  const parsed = api.auth.register.input.parse({ ...base, role: "staff", status: "active" });
  assert.equal("role" in parsed, false);
  assert.equal("status" in parsed, false);
  assert.throws(() => api.auth.register.input.parse({ ...base, password: "weak" }));
});

test("transfers require an OTP challenge and six-digit code", () => {
  assert.throws(() => api.transactions.transfer.input.parse({ fromAccountId: 1, toAccountNumber: "1234567890", amount: "10.00" }));
  assert.doesNotThrow(() => api.transactions.transfer.input.parse({ fromAccountId: 1, toAccountNumber: "1234567890", amount: "10.00", otpChallenge: "a".repeat(20), otpCode: "123456" }));
});
