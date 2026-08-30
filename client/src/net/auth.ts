import { Clerk } from "@clerk/clerk-js";

type AuthListener = () => void;

const DEMO_STORAGE_KEY = "sv-demo-user";

type DemoUser = { id: string; displayName: string };

let clerk: Clerk | null = null;
let userId: string | null = null;
let displayName: string | null = null;
let demoUser: DemoUser | null = null;
const listeners = new Set<AuthListener>();

function emit(): void {
  for (const fn of listeners) fn();
}

function syncFromClerk(): void {
  if (demoUser) return;
  const user = clerk?.user ?? null;
  userId = user?.id ?? null;
  displayName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    (user ? "Founder" : null);
}

function applyDemo(user: DemoUser | null): void {
  demoUser = user;
  userId = user?.id ?? null;
  displayName = user?.displayName ?? null;
}

function loadStoredDemo(): DemoUser | null {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoUser;
    if (
      typeof parsed.id === "string" &&
      parsed.id.startsWith("demo-") &&
      typeof parsed.displayName === "string"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function demoToken(user: DemoUser): string {
  return `sv-demo.${user.id}.${encodeURIComponent(user.displayName)}`;
}

export function isAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
}

export function isDemoAuthAvailable(): boolean {
  return !isClerkReady();
}

export function isDemoSession(): boolean {
  return demoUser !== null;
}

export function canSignIn(): boolean {
  return isClerkReady() || isDemoAuthAvailable();
}

export async function initAuth(): Promise<void> {
  const stored = loadStoredDemo();
  if (stored) {
    applyDemo(stored);
  }

  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  if (!key) {
    return;
  }
  try {
    clerk = new Clerk(key);
    await clerk.load();
    if (clerk.user) {
      applyDemo(null);
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
    syncFromClerk();
    clerk.addListener(() => {
      if (clerk?.user && demoUser) {
        applyDemo(null);
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
      syncFromClerk();
      emit();
    });
  } catch (err) {
    console.error("Clerk failed to load — demo sign-in is available.", err);
    clerk = null;
  }
}

export function getUserId(): string | null {
  return userId;
}

export function getDisplayName(): string | null {
  return displayName;
}

export function onAuthChange(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function getToken(): Promise<string | null> {
  if (demoUser) return demoToken(demoUser);
  if (!clerk?.session) return null;
  try {
    return (await clerk.session.getToken()) ?? null;
  } catch {
    return null;
  }
}

export function openSignIn(): void {
  if (clerk) {
    void clerk.openSignIn();
    return;
  }
  const existing = demoUser ?? loadStoredDemo();
  const user: DemoUser = existing ?? {
    id: `demo-${
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }`,
    displayName: "Founder",
  };
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
  applyDemo(user);
  emit();
}

export function signOut(): void {
  if (demoUser) {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    applyDemo(null);
    emit();
    return;
  }
  if (!clerk) return;
  void clerk.signOut();
}

export function isClerkReady(): boolean {
  return clerk !== null;
}
