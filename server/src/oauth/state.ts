import { decryptToken, encryptToken } from "../crypto/tokens";

const TTL_MS = 10 * 60 * 1000;

export type OAuthState = {
  userId: string;
  plotId: string;
  provider: "stripe" | "polar";
  exp: number;
};

export function encodeOAuthState(input: Omit<OAuthState, "exp">): string {
  const payload: OAuthState = {
    ...input,
    exp: Date.now() + TTL_MS,
  };
  // base64url so `+` in AES ciphertext cannot be decoded as a space in query strings.
  return Buffer.from(encryptToken(JSON.stringify(payload)), "utf8").toString(
    "base64url",
  );
}

export function decodeOAuthState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const cipher = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decryptToken(cipher)) as OAuthState;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.plotId !== "string" ||
      (parsed.provider !== "stripe" && parsed.provider !== "polar") ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
