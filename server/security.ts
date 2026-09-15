import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

export type SecurityTokenType = "email_verification" | "password_reset" | "login_otp" | "transfer_otp";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function encryptionKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY must be set");
  return createHash("sha256").update(raw).digest();
}

export function encryptSensitive(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSensitive(payload: string): string {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function sanitizeUser<T extends Record<string, any>>(user: T) {
  const { password, ssnLast4, ssnLast4Encrypted, ...safe } = user;
  return { ...safe, ssnMasked: ssnLast4 || ssnLast4Encrypted ? "***-**-****" : null };
}
