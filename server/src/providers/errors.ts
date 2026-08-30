export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function assertNeverLogTokens(text: string): string {
  return text
    .replace(/sk_(?:test|live)_[A-Za-z0-9]+/g, "sk_***")
    .replace(/rk_(?:test|live)_[A-Za-z0-9]+/g, "rk_***")
    .replace(/polar_(?:at|rt|oat|pat)_[A-Za-z0-9]+/g, "polar_***");
}
