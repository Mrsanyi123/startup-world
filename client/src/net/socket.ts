import { io, type Socket } from "socket.io-client";
import {
  PLAYER_MOVE_HZ,
  type ClientToServerEvents,
  type HouseTierChanged,
  type PlotView,
  type RemotePlayerState,
  type ServerToClientEvents,
} from "@startup-village/shared";
import { getToken } from "./auth";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type RealtimeHandlers = {
  onWelcome: (selfId: string, players: RemotePlayerState[]) => void;
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerMoved: (player: RemotePlayerState) => void;
  onPlayerLeft: (id: string) => void;
  onPlotClaimed: (plot: PlotView) => void;
  onHouseTierChanged: (change: HouseTierChanged) => void;
  onPresence: () => void;
};

let socket: GameSocket | null = null;
let handlers: RealtimeHandlers | null = null;
let online = 1;
let fullMessage: string | null = null;

export function walkingCount(): number {
  return online;
}

export function planetFullMessage(): string | null {
  return fullMessage;
}

function bind(next: GameSocket): void {
  next.on("planet:welcome", (payload) => {
    online = payload.online;
    fullMessage = null;
    handlers?.onWelcome(payload.id, payload.players);
    handlers?.onPresence();
  });
  next.on("planet:full", (payload) => {
    fullMessage = payload.message;
    next.io.opts.reconnection = false;
    handlers?.onPresence();
  });
  next.on("planet:presence", (payload) => {
    online = payload.online;
    handlers?.onPresence();
  });
  next.on("player:joined", (player) => handlers?.onPlayerJoined(player));
  next.on("player:moved", (player) => handlers?.onPlayerMoved(player));
  next.on("player:left", (payload) => handlers?.onPlayerLeft(payload.id));
  next.on("plot:claimed", (plot) => handlers?.onPlotClaimed(plot));
  next.on("house:tier_changed", (change) =>
    handlers?.onHouseTierChanged(change),
  );
}

export async function connectRealtime(
  nextHandlers: RealtimeHandlers,
): Promise<void> {
  handlers = nextHandlers;
  const token = await getToken();
  if (socket) {
    socket.auth = { token: token ?? undefined };
    socket.disconnect().connect();
    return;
  }
  socket = io({
    path: "/socket.io",
    auth: { token: token ?? undefined },
    transports: ["websocket", "polling"],
  });
  bind(socket);
}

export function sendMove(
  position: { x: number; y: number; z: number },
  facing: { x: number; y: number; z: number },
): void {
  if (!socket?.connected) return;
  socket.emit("player:move", {
    x: position.x,
    y: position.y,
    z: position.z,
    facingX: facing.x,
    facingY: facing.y,
    facingZ: facing.z,
  });
}

export const MOVE_INTERVAL = 1 / PLAYER_MOVE_HZ;

export function disposeRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  handlers = null;
}
