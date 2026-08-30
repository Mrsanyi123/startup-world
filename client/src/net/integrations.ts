import { api } from "./api";

export type IntegrationsStatus = {
  stripe: { configured: boolean; demo?: boolean };
  polar: { configured: boolean; demo?: boolean; missing: string[] };
};

let cached: IntegrationsStatus | null = null;

export async function loadIntegrationsStatus(): Promise<IntegrationsStatus> {
  try {
    const res = await api("/integrations/status");
    if (!res.ok) throw new Error("status failed");
    cached = (await res.json()) as IntegrationsStatus;
    return cached;
  } catch {
    cached = {
      stripe: { configured: false, demo: true },
      polar: {
        configured: false,
        demo: true,
        missing: ["POLAR_CLIENT_ID", "POLAR_CLIENT_SECRET"],
      },
    };
    return cached;
  }
}

export function integrationsStatus(): IntegrationsStatus | null {
  return cached;
}

export type OAuthStartResult =
  | { ok: true; authorizeUrl: string }
  | { ok: false; comingSoon?: boolean; message: string };

export async function connectDemoBilling(
  provider: "stripe" | "polar",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await api("/integrations/demo/connect", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        message: body.error ?? `Could not connect demo ${provider}.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Cannot reach the server." };
  }
}

export async function startOAuth(
  provider: "stripe" | "polar",
): Promise<OAuthStartResult> {
  try {
    const res = await api(`/integrations/${provider}/oauth/start`, {
      headers: { Accept: "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as {
      authorizeUrl?: string;
      error?: string;
      comingSoon?: boolean;
    };
    if (res.status === 503 && (body.comingSoon || provider === "polar")) {
      return {
        ok: false,
        comingSoon: true,
        message:
          body.error ??
          "Coming soon — Polar app keys are not set on the server.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: body.error ?? `Could not start ${provider} connect (${res.status}).`,
      };
    }
    if (!body.authorizeUrl) {
      return { ok: false, message: "Server did not return an authorize URL." };
    }
    return { ok: true, authorizeUrl: body.authorizeUrl };
  } catch {
    return { ok: false, message: "Cannot reach the server." };
  }
}
