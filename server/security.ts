import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function encryptionKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET must be set");
  return createHash("sha256").update(`redbird-sensitive-data:${raw}`).digest();
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
