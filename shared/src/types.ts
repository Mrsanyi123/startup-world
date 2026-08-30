export type PlotStatus = "unclaimed" | "claimed";
export type Provider = "stripe" | "polar";

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type User = {
  id: string;
  displayName: string;
  createdAt: string;
};

export type Plot = {
  id: string;
  position: Vec3;
  ownerId: string | null;
  status: PlotStatus;
  claimedAt: string | null;
};

export type Connection = {
  id: string;
  plotId: string;
  provider: Provider;
  accessToken: string;
  refreshToken: string | null;
  isMrrPublic: boolean;
  connectedAt: string;
};

export type MrrSnapshot = {
  id: string;
  connectionId: string;
  mrrCents: number;
  computedAt: string;
};

export type HouseTier = {
  tierIndex: number;
  label: string;
  mrrThresholdCents: number;
  modelRef: string;
};

/**
 * Public plot payload for GET /plots. Tokens are never included.
 * `mrrCents` is null unless `isMrrPublic` or the requester owns the plot.
 * `connectionId` is only present for the owning requester (PATCH privacy).
 */
export type PlotView = {
  id: string;
  position: Vec3;
  ownerId: string | null;
  ownerDisplayName: string | null;
  status: PlotStatus;
  claimedAt: string | null;
  tierIndex: number | null;
  tierLabel: string | null;
  isMrrPublic: boolean;
  mrrCents: number | null;
  connectionId: string | null;
  /** Present when a billing connection exists. `broken` keeps the last house. */
  connectionStatus: "ok" | "broken" | null;
  provider: Provider | null;
};
