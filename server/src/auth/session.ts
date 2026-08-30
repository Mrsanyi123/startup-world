import { createClerkClient, verifyToken } from "@clerk/backend";
import type { FastifyRequest } from "fastify";
import { CLERK_SECRET_KEY, VITE_ORIGIN } from "../env";
import { db } from "../db";
import { users } from "../db/schema";
import { demoAuthEnabled, parseDemoToken } from "../demo/token";

export type SessionUser = {
  id: string;
  displayName: string;
};

let clerkClient: ReturnType<typeof createClerkClient> | null = null;

function clerk() {
  if (!CLERK_SECRET_KEY) return null;
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  }
  return clerkClient;
}

async function resolveDisplayName(userId: string): Promise<string> {
  const api = clerk();
  if (!api) return "Founder";
  try {
    const user = await api.users.getUser(userId);
    return (
      user.fullName?.trim() ||
      user.firstName?.trim() ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "Founder"
    );
  } catch {
    return "Founder";
  }
}

const authorizedParties = [
  VITE_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/** Optional auth: invalid or missing token → null (never throws). */
export async function userFromToken(
  token: string,
): Promise<SessionUser | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (demoAuthEnabled()) {
    const demo = parseDemoToken(trimmed);
    if (demo) return demo;
  }
  if (!CLERK_SECRET_KEY) return null;
  try {
    const payload = await verifyToken(trimmed, {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties,
    });
    const id = payload.sub;
    if (!id) return null;
    return { id, displayName: await resolveDisplayName(id) };
  } catch {
    return null;
  }
}

/** Optional auth: invalid or missing token → null (never throws). */
export async function getSessionUser(
  req: FastifyRequest,
): Promise<SessionUser | null> {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const fromHeader = await userFromToken(header.slice("Bearer ".length));
    if (fromHeader) return fromHeader;
  }
  if (!CLERK_SECRET_KEY) return null;

  const api = clerk();
  if (!api) return null;
  try {
    const url = `${req.protocol}://${req.hostname}${req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    const requestState = await api.authenticateRequest(
      new Request(url, { method: req.method, headers }),
      { authorizedParties, secretKey: CLERK_SECRET_KEY },
    );
    const auth = requestState.toAuth() as { userId?: string | null } | null;
    const id = auth?.userId ?? null;
    if (!id) return null;
    return { id, displayName: await resolveDisplayName(id) };
  } catch {
    return null;
  }
}

export async function upsertUser(user: SessionUser): Promise<void> {
  if (!db) return;
  await db
    .insert(users)
    .values({ id: user.id, displayName: user.displayName })
    .onConflictDoUpdate({
      target: users.id,
      set: { displayName: user.displayName },
    });
}
