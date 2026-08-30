import { CLERK_SECRET_KEY } from "../env";

export type DemoUser = {
  id: string;
  displayName: string;
};

export const DEMO_TOKEN_PREFIX = "sv-demo.";

/** Demo sign-in is used when Clerk is not configured. */
export function demoAuthEnabled(): boolean {
  return !CLERK_SECRET_KEY;
}

export function issueDemoToken(user: DemoUser): string {
  return `${DEMO_TOKEN_PREFIX}${user.id}.${encodeURIComponent(user.displayName)}`;
}

export function parseDemoToken(token: string): DemoUser | null {
  if (!token.startsWith(DEMO_TOKEN_PREFIX)) return null;
  const rest = token.slice(DEMO_TOKEN_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot <= 0) return null;
  const id = rest.slice(0, dot);
  if (!/^demo-[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  let displayName: string;
  try {
    displayName = decodeURIComponent(rest.slice(dot + 1));
  } catch {
    return null;
  }
  displayName = displayName.trim().slice(0, 40);
  if (!displayName) return null;
  return { id, displayName };
}
