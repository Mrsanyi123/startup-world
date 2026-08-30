import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

config({ path: resolve(repoRoot, ".env") });

export const PORT = Number(process.env.PORT) || 3001;
export const VITE_ORIGIN = process.env.VITE_ORIGIN ?? "http://localhost:5173";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";
export const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? "";
export const INTERNAL_JOB_SECRET = process.env.INTERNAL_JOB_SECRET ?? "";
export const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? "";

export const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID ?? "";
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
/** `read_only` (extensions) or `read_write` (platforms). We only ever GET. */
export const STRIPE_OAUTH_SCOPE = process.env.STRIPE_OAUTH_SCOPE ?? "read_only";

export const POLAR_CLIENT_ID = process.env.POLAR_CLIENT_ID ?? "";
export const POLAR_CLIENT_SECRET = process.env.POLAR_CLIENT_SECRET ?? "";
export const POLAR_SANDBOX =
  process.env.POLAR_SANDBOX === "1" || process.env.POLAR_SANDBOX === "true";

const polarApiDefault = POLAR_SANDBOX
  ? "https://sandbox-api.polar.sh"
  : "https://api.polar.sh";
const polarAuthorizeDefault = POLAR_SANDBOX
  ? "https://sandbox.polar.sh/oauth2/authorize"
  : "https://polar.sh/oauth2/authorize";

export const POLAR_API_BASE = (
  process.env.POLAR_API_BASE ?? polarApiDefault
).replace(/\/$/, "");
export const POLAR_AUTHORIZE_URL =
  process.env.POLAR_AUTHORIZE_URL ?? polarAuthorizeDefault;

/** Origin Stripe/Polar redirect back to (API or Vite-proxied). */
export const OAUTH_REDIRECT_ORIGIN = (
  process.env.OAUTH_REDIRECT_ORIGIN ?? `http://localhost:${PORT}`
).replace(/\/$/, "");

export const MIGRATIONS_DIR = resolve(here, "../drizzle");

export function stripeConfigured(): boolean {
  return Boolean(STRIPE_CLIENT_ID && STRIPE_SECRET_KEY && TOKEN_ENCRYPTION_KEY);
}

export function polarConfigured(): boolean {
  return Boolean(POLAR_CLIENT_ID && POLAR_CLIENT_SECRET && TOKEN_ENCRYPTION_KEY);
}

export function stripeCallbackUrl(): string {
  return `${OAUTH_REDIRECT_ORIGIN}/integrations/stripe/oauth/callback`;
}

export function polarCallbackUrl(): string {
  return `${OAUTH_REDIRECT_ORIGIN}/integrations/polar/oauth/callback`;
}
