export type {
  PlotStatus,
  Provider,
  Vec3,
  User,
  Plot,
  Connection,
  MrrSnapshot,
  HouseTier,
  PlotView,
} from "./types";

export {
  PLANET_RADIUS,
  PLOT_COUNT,
  plotId,
  fibonacciSpherePoint,
  plotLayout,
} from "./plots";

export {
  LAYOUT_RADIUS,
  PLOT_FOOTPRINT_RADIUS,
  ROAD_HALF_WIDTH,
  PLOT_CLAIM_RANGE,
  PLOT_POSITIONS,
  ROAD_SEGMENTS,
} from "./layout";
export type { RoadSegment } from "./layout";

export { ASSET_MANIFEST } from "./assetManifest";
export type { AssetEntry, AssetKey, Pivot } from "./assetManifest";

export { HOUSE_TIERS, tierForMrr } from "./houseTiers";

export { DEMO_PLOTS, RESERVED_PLOT_IDS } from "./demoPlots";

export {
  PLANET_ROOM,
  PLANET_ROOM_CAP,
  PLAYER_MOVE_HZ,
} from "./realtime";

export type {
  PlayerPose,
  RemotePlayerState,
  HouseTierChanged,
  PlanetWelcome,
  PlanetFull,
  PlanetPresence,
  PlayerLeft,
  ClientToServerEvents,
  ServerToClientEvents,
} from "./realtime";
