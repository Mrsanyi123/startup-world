import {
  STRIPE_CLIENT_ID,
  STRIPE_OAUTH_SCOPE,
  STRIPE_SECRET_KEY,
  stripeCallbackUrl,
} from "../env";
import { ProviderHttpError, assertNeverLogTokens } from "./errors";

const AUTHORIZE = "https://connect.stripe.com/oauth/authorize";
const TOKEN = "https://connect.stripe.com/oauth/token";
const API = "https://api.stripe.com/v1";

export type StripeTokenResponse = {
  access_token?: string;
  refresh_token?: string | null;
  stripe_user_id?: string;
  scope?: string;
  livemode?: boolean;
};

export function stripeAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", STRIPE_CLIENT_ID);
  url.searchParams.set("scope", STRIPE_OAUTH_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", stripeCallbackUrl());
  return url.toString();
}

export async function exchangeStripeCode(
  code: string,
): Promise<StripeTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuth(STRIPE_SECRET_KEY),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as StripeTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new ProviderHttpError(
      res.status,
      assertNeverLogTokens(
        json.error_description ?? json.error ?? "Stripe token exchange failed",
      ),
    );
  }
  return json;
}

export async function refreshStripeAccessToken(
  refreshToken: string,
): Promise<StripeTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuth(STRIPE_SECRET_KEY),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as StripeTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new ProviderHttpError(
      res.status,
      assertNeverLogTokens(
        json.error_description ?? json.error ?? "Stripe token refresh failed",
      ),
    );
  }
  return json;
}

/**
 * List all subscriptions (paginated). Uses the platform secret +
 * Stripe-Account when we have an account id; otherwise the OAuth access token.
 */
export async function listStripeSubscriptions(opts: {
  accessToken: string;
  accountId: string | null;
}): Promise<unknown> {
  const items: unknown[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < 20; page++) {
    const url = new URL(`${API}/subscriptions`);
    url.searchParams.set("status", "all");
    url.searchParams.set("limit", "100");
    url.searchParams.append("expand[]", "data.items.data.price");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const headers = stripeRequestHeaders(opts);
    const res = await fetch(url, { headers });
    const json = (await res.json()) as {
      data?: { id?: string }[];
      has_more?: boolean;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new ProviderHttpError(
        res.status,
        assertNeverLogTokens(json.error?.message ?? "Stripe list failed"),
      );
    }
    const data = json.data ?? [];
    items.push(...data);
    if (!json.has_more || data.length === 0) break;
    const lastId = data[data.length - 1]?.id;
    if (!lastId) break;
    startingAfter = lastId;
  }

  return { object: "list", data: items };
}

function stripeRequestHeaders(opts: {
  accessToken: string;
  accountId: string | null;
}): Headers {
  const headers = new Headers({ Accept: "application/json" });
  if (opts.accountId && STRIPE_SECRET_KEY) {
    headers.set("Authorization", `Bearer ${STRIPE_SECRET_KEY}`);
    headers.set("Stripe-Account", opts.accountId);
    return headers;
  }
  headers.set("Authorization", `Bearer ${opts.accessToken}`);
  return headers;
}

function basicAuth(secret: string): string {
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}
