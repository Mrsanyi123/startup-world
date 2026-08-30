import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "v1:";

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

/** Decode TOKEN_ENCRYPTION_KEY into 32 bytes (hex, base64, or raw). */
export function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new TokenCryptoError(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) return utf8;
  throw new TokenCryptoError(
    "TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars, base64, or raw).",
  );
}

function key(): Buffer {
  return parseEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY ?? "");
}

/** True when the column looks like our AES-256-GCM ciphertext (not a demo stub). */
export function isTokenCiphertext(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypt a secret at rest. Output is `v1:` + base64(iv || tag || ciphertext).
 * Never log the plaintext or the result.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  if (!isTokenCiphertext(ciphertext)) {
    throw new TokenCryptoError("value is not an encrypted token");
  }
  const buf = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new TokenCryptoError("ciphertext is truncated");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
