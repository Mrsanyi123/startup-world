import type { PlotView } from "./types";

export const PLANET_ROOM = "planet";
export const PLANET_ROOM_CAP = 20;
/** Client send rate for `player:move`. */
export const PLAYER_MOVE_HZ = 12;

export type PlayerPose = {
  x: number;
  y: number;
  z: number;
  facingX: number;
  facingY: number;
  facingZ: number;
};

export type RemotePlayerState = PlayerPose & {
  id: string;
  displayName: string;
};

export type HouseTierChanged = {
  plotId: string;
  tierIndex: number;
};

export type PlanetWelcome = {
  id: string;
  displayName: string;
  players: RemotePlayerState[];
  online: number;
};

export type PlanetFull = {
  message: string;
};

export type PlanetPresence = {
  online: number;
};

export type PlayerLeft = {
  id: string;
};

export type ClientToServerEvents = {
  "player:move": (pose: PlayerPose) => void;
};

export type ServerToClientEvents = {
  "planet:welcome": (payload: PlanetWelcome) => void;
  "planet:full": (payload: PlanetFull) => void;
  "planet:presence": (payload: PlanetPresence) => void;
  "player:joined": (player: RemotePlayerState) => void;
  "player:moved": (player: RemotePlayerState) => void;
  "player:left": (payload: PlayerLeft) => void;
  "plot:claimed": (plot: PlotView) => void;
  "house:tier_changed": (payload: HouseTierChanged) => void;
};
