import {
  POLAR_API_BASE,
  POLAR_AUTHORIZE_URL,
  POLAR_CLIENT_ID,
  POLAR_CLIENT_SECRET,
  polarCallbackUrl,
} from "../env";
import { ProviderHttpError, assertNeverLogTokens } from "./errors";

/** Read-only. Polar also has orders:read; subscriptions are enough for MRR. */
export const POLAR_SCOPES = "subscriptions:read";

export type PolarTokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export function polarAuthorizeUrl(state: string): string {
  const url = new URL(POLAR_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", POLAR_CLIENT_ID);
  url.searchParams.set("redirect_uri", polarCallbackUrl());
  url.searchParams.set("scope", POLAR_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangePolarCode(
  code: string,
): Promise<PolarTokenResponse> {
  return polarTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: polarCallbackUrl(),
  });
}

export async function refreshPolarAccessToken(
  refreshToken: string,
): Promise<PolarTokenResponse> {
  return polarTokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function polarTokenRequest(
  params: Record<string, string>,
): Promise<PolarTokenResponse> {
  const body = new URLSearchParams({
    client_id: POLAR_CLIENT_ID,
    client_secret: POLAR_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch(`${POLAR_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as PolarTokenResponse & {
    error?: string;
    error_description?: string;
    detail?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new ProviderHttpError(
      res.status,
      assertNeverLogTokens(
        json.error_description ??
          json.detail ??
          json.error ??
          "Polar token request failed",
      ),
    );
  }
  return json;
}

export async function listPolarSubscriptions(
  accessToken: string,
): Promise<unknown> {
  const items: unknown[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(`${POLAR_API_BASE}/v1/subscriptions/`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("page", String(page));
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const json = (await res.json()) as {
      items?: unknown[];
      pagination?: { max_page?: number };
      detail?: string;
    };
    if (!res.ok) {
      throw new ProviderHttpError(
        res.status,
        assertNeverLogTokens(
          typeof json.detail === "string" ? json.detail : "Polar list failed",
        ),
      );
    }
    const batch = json.items ?? [];
    items.push(...batch);
    const maxPage = json.pagination?.max_page ?? page;
    if (page >= maxPage || batch.length === 0) break;
  }
  return { items };
}
