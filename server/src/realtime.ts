import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import {
  PLANET_RADIUS,
  PLANET_ROOM,
  PLANET_ROOM_CAP,
  type ClientToServerEvents,
  type HouseTierChanged,
  type PlayerPose,
  type PlotView,
  type RemotePlayerState,
  type ServerToClientEvents,
} from "@startup-village/shared";
import { VITE_ORIGIN } from "./env";
import { userFromToken } from "./auth/session";

type SocketData = {
  displayName: string;
  userId: string | null;
};

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const DEFAULT_POSE: PlayerPose = {
  x: 0,
  y: 0,
  z: PLANET_RADIUS,
  facingX: 0,
  facingY: 1,
  facingZ: 0,
};

let io: IoServer | null = null;
const lastPose = new Map<string, PlayerPose>();

function isPose(value: unknown): value is PlayerPose {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    ["x", "y", "z", "facingX", "facingY", "facingZ"] as const
  ).every((key) => typeof o[key] === "number" && Number.isFinite(o[key]));
}

function roomSize(): number {
  return io?.sockets.adapter.rooms.get(PLANET_ROOM)?.size ?? 0;
}

function snapshotExcept(exceptId: string): RemotePlayerState[] {
  if (!io) return [];
  const out: RemotePlayerState[] = [];
  for (const [id, socket] of io.sockets.sockets) {
    if (id === exceptId) continue;
    if (!socket.rooms.has(PLANET_ROOM)) continue;
    const pose = lastPose.get(id) ?? DEFAULT_POSE;
    out.push({
      id,
      displayName: socket.data.displayName,
      ...pose,
    });
  }
  return out;
}

function emitPresence(): void {
  io?.to(PLANET_ROOM).emit("planet:presence", { online: roomSize() });
}

export function attachRealtime(httpServer: HttpServer): void {
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: [VITE_ORIGIN, "http://127.0.0.1:5173"],
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    const raw = socket.handshake.auth?.token;
    const token = typeof raw === "string" ? raw : "";
    const user = token ? await userFromToken(token) : null;
    socket.data.userId = user?.id ?? null;
    socket.data.displayName = user?.displayName ?? "Wanderer";
    next();
  });

  io.on("connection", (socket) => {
    if (roomSize() >= PLANET_ROOM_CAP) {
      socket.emit("planet:full", {
        message: `This planet is full (${PLANET_ROOM_CAP} walkers). Try again later.`,
      });
      socket.disconnect(true);
      return;
    }

    const displayName = socket.data.displayName;
    lastPose.set(socket.id, { ...DEFAULT_POSE });
    socket.join(PLANET_ROOM);

    const others = snapshotExcept(socket.id);
    socket.emit("planet:welcome", {
      id: socket.id,
      displayName,
      players: others,
      online: roomSize(),
    });

    const joined: RemotePlayerState = {
      id: socket.id,
      displayName,
      ...DEFAULT_POSE,
    };
    socket.to(PLANET_ROOM).emit("player:joined", joined);
    emitPresence();

    socket.on("player:move", (pose) => {
      if (!isPose(pose)) return;
      lastPose.set(socket.id, pose);
      socket.to(PLANET_ROOM).emit("player:moved", {
        id: socket.id,
        displayName: socket.data.displayName,
        ...pose,
      });
    });

    socket.on("disconnect", () => {
      lastPose.delete(socket.id);
      socket.to(PLANET_ROOM).emit("player:left", { id: socket.id });
      emitPresence();
    });
  });
}

export function broadcastPlotClaimed(plot: PlotView): void {
  io?.to(PLANET_ROOM).emit("plot:claimed", plot);
}

export function broadcastHouseTierChanged(payload: HouseTierChanged): void {
  io?.to(PLANET_ROOM).emit("house:tier_changed", payload);
}
