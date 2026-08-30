import {
  canSignIn,
  getDisplayName,
  getUserId,
  isDemoSession,
  openSignIn,
  signOut,
} from "../net/auth";
import {
  connectDemoBilling,
  integrationsStatus,
  startOAuth,
} from "../net/integrations";
import {
  listPlots,
  playerPlot,
  refreshPlots,
  setMrrPublic,
  worldError,
  type WorldPlot,
} from "../net/plots";
import { planetFullMessage, walkingCount } from "../net/socket";

const GAME_NAME = "Startup Village";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export interface Hud {
  sync(): void;
  flash(message: string, kind?: "ok" | "err"): void;
  dispose(): void;
}

export function createHud(onWorldChanged: () => void): Hud {
  const brand = document.createElement("div");
  brand.id = "hud-brand";
  brand.innerHTML = `<strong>${GAME_NAME}</strong><span id="hud-claimed"></span><span id="hud-online"></span>`;
  document.body.appendChild(brand);

  const auth = document.createElement("div");
  auth.id = "hud-auth";
  document.body.appendChild(auth);

  const err = document.createElement("div");
  err.id = "hud-error";
  document.body.appendChild(err);

  const banner = document.createElement("div");
  banner.id = "hud-banner";
  document.body.appendChild(banner);

  const card = document.createElement("div");
  card.id = "hud-plot-card";
  document.body.appendChild(card);

  let flashText: string | null = null;
  let flashKind: "ok" | "err" = "ok";
  let connecting: "stripe" | "polar" | null = null;

  const onAuthClick = (e: MouseEvent) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.action === "signin") openSignIn();
    if (t.dataset.action === "signout") void signOut();
  };
  auth.addEventListener("click", onAuthClick);

  const onCardChange = (e: Event) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type !== "checkbox") return;
    const id = t.dataset.connectionId;
    if (!id) return;
    void setMrrPublic(id, t.checked).then(() => onWorldChanged());
  };
  card.addEventListener("change", onCardChange);

  const onCardClick = (e: MouseEvent) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const provider = t.dataset.connect;
    if (provider !== "stripe" && provider !== "polar") return;
    if (connecting) return;

    const status = integrationsStatus();
    const useDemo =
      (provider === "stripe" && !status?.stripe.configured) ||
      (provider === "polar" && !status?.polar.configured);

    connecting = provider;
    renderCard(playerPlot(getUserId()));

    if (useDemo) {
      void connectDemoBilling(provider).then(async (result) => {
        connecting = null;
        if (result.ok) {
          await refreshPlots();
          onWorldChanged();
          flashText =
            provider === "polar"
              ? "Demo Polar connected — shack ($100/mo)."
              : "Demo Stripe connected — cottage ($1,200/mo).";
          flashKind = "ok";
        } else {
          flashText = result.message;
          flashKind = "err";
        }
        renderCard(playerPlot(getUserId()));
        renderBanner();
      });
      return;
    }

    void startOAuth(provider).then((result) => {
      connecting = null;
      if (result.ok) {
        window.location.href = result.authorizeUrl;
        return;
      }
      flashText = result.comingSoon
        ? "Coming soon — Polar app keys are not set."
        : result.message;
      flashKind = "err";
      renderCard(playerPlot(getUserId()));
      renderBanner();
    });
  };
  card.addEventListener("click", onCardClick);

  function renderAuth(): void {
    const uid = getUserId();
    if (uid) {
      const name = getDisplayName() ?? "You";
      const demo = isDemoSession() ? `<span class="demo">demo</span>` : "";
      auth.innerHTML = `<span class="who">${name}</span>${demo}<button type="button" data-action="signout">Sign out</button>`;
      return;
    }
    if (!canSignIn()) {
      auth.innerHTML = `<button type="button" disabled title="Sign-in is unavailable">Sign in</button>`;
      return;
    }
    auth.innerHTML = `<button type="button" data-action="signin">Sign in</button>`;
  }

  function renderCard(mine: WorldPlot | null): void {
    if (!mine) {
      card.classList.remove("visible");
      card.innerHTML = "";
      return;
    }
    const status = integrationsStatus();
    const tier = mine.tierLabel ?? "no house yet";
    const mrr =
      mine.mrrCents !== null
        ? formatUsd(mine.mrrCents)
        : mine.connectionId
          ? "Private"
          : "Connect billing to grow a house";
    const toggle = mine.connectionId
      ? `<label class="toggle"><input type="checkbox" data-connection-id="${mine.connectionId}" ${mine.isMrrPublic ? "checked" : ""}/> Show my MRR to others</label>`
      : "";
    const disconnected =
      mine.connectionStatus === "broken"
        ? `<div class="disconnected">Disconnected — last house kept</div>`
        : "";
    const stripeDemo = status && !status.stripe.configured;
    const polarDemo = status && !status.polar.configured;
    const stripeBusy = connecting === "stripe";
    const polarBusy = connecting === "polar";
    const stripeLabel = stripeBusy
      ? "Connecting…"
      : stripeDemo
        ? "Demo Stripe"
        : "Connect Stripe";
    const polarLabel = polarBusy
      ? "Connecting…"
      : polarDemo
        ? "Demo Polar"
        : "Connect Polar";
    card.innerHTML = `
      <div class="eyebrow">Your plot</div>
      <div class="tier">${tier}</div>
      <div class="mrr">${mrr}</div>
      ${disconnected}
      ${toggle}
      <div class="connect">
        <button type="button" data-connect="stripe" ${stripeBusy ? "disabled" : ""}>${stripeLabel}</button>
        <button type="button" data-connect="polar" ${polarBusy ? "disabled" : ""}>${polarLabel}</button>
        ${stripeDemo || polarDemo ? "<span>Demo billing — no Stripe/Polar keys needed</span>" : ""}
      </div>
    `;
    card.classList.add("visible");
  }

  function renderBanner(): void {
    const world = planetFullMessage() ?? worldError();
    const message = flashText ?? world;
    const kind = flashText ? flashKind : "err";
    if (!message) {
      err.classList.remove("visible");
      banner.classList.remove("visible");
      err.textContent = "";
      banner.textContent = "";
      return;
    }
    if (kind === "ok") {
      err.classList.remove("visible");
      err.textContent = "";
      banner.textContent = message;
      banner.classList.add("visible");
    } else {
      banner.classList.remove("visible");
      banner.textContent = "";
      err.textContent = message;
      err.classList.add("visible");
    }
  }

  return {
    sync() {
      const all = listPlots();
      const claimed = all.filter((p) => p.status === "claimed").length;
      const claimedEl = brand.querySelector("#hud-claimed");
      if (claimedEl) claimedEl.textContent = `${claimed} / ${all.length} claimed`;
      const onlineEl = brand.querySelector("#hud-online");
      if (onlineEl) onlineEl.textContent = `${walkingCount()} walking`;

      renderAuth();
      renderCard(playerPlot(getUserId()));
      renderBanner();
    },
    flash(message, kind = "ok") {
      flashText = message;
      flashKind = kind;
      renderBanner();
    },
    dispose() {
      auth.removeEventListener("click", onAuthClick);
      card.removeEventListener("change", onCardChange);
      card.removeEventListener("click", onCardClick);
      brand.remove();
      auth.remove();
      err.remove();
      banner.remove();
      card.remove();
    },
  };
}
