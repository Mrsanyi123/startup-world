import { describe, expect, test } from "vitest";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const { decryptToken, encryptToken, isTokenCiphertext, parseEncryptionKey } =
  await import("./tokens");

describe("token encryption", () => {
  test("round-trips a token", () => {
    const cipher = encryptToken("sk_test_secret");
    expect(isTokenCiphertext(cipher)).toBe(true);
    expect(cipher).not.toContain("sk_test_secret");
    expect(decryptToken(cipher)).toBe("sk_test_secret");
  });

  test("same plaintext yields different ciphertext (random IV)", () => {
    expect(encryptToken("abc")).not.toBe(encryptToken("abc"));
  });

  test("rejects demo stubs", () => {
    expect(isTokenCiphertext("stub")).toBe(false);
  });

  test("parses 64-char hex keys", () => {
    const key = parseEncryptionKey(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(key.length).toBe(32);
  });
});
