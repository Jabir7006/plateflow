import type { Server as HttpServer } from "node:http";
import {
  Server,
  type DefaultEventsMap,
  type Socket,
} from "socket.io";
import {
  ORDER_EVENTS,
  SOCKET_AUTH_ERROR,
  type OrderEventPayload,
  type OrderStatusView,
  type StaffOrderView,
} from "@plateflow/shared";
import type { Role } from "../generated/prisma/enums.js";
import { ENV } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { verifyWsTicket } from "./ticket.js";

// Realtime fan-out for the live kitchen board and the diner status page. One
// Node process, so the order service calls emitOrderNew/emitOrderUpdated below
// directly and socket.io's own room broadcast is the fan-out — no intermediate
// event bus. Scaling to multiple instances later means adding the socket.io
// Redis adapter here; nothing else changes.

const STAFF_ROOM = "staff";
const orderRoom = (orderId: string) => `order:${orderId}`;

// Set on the socket during the handshake so the connection handler knows which
// room to join. Populated by authenticateSocket before "connection" fires.
interface SocketData {
  kind?: "staff" | "diner";
  userId?: string;
  role?: Role;
  orderId?: string;
}

type IoServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
type IoSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

let io: IoServer | null = null;

// Authenticate a handshake as either staff (a short-lived ticket) or a diner
// (their table token + order id, the same public capability the REST read uses,
// re-checked against the DB so an order can't be watched under the wrong token).
// Returns whether the socket may connect; on success it stamps socket.data.
async function authenticateSocket(socket: IoSocket): Promise<boolean> {
  const auth = socket.handshake.auth as Record<string, unknown>;

  const ticket = auth.ticket;
  if (typeof ticket === "string") {
    try {
      const { userId, role } = verifyWsTicket(ticket);
      socket.data.kind = "staff";
      socket.data.userId = userId;
      socket.data.role = role;
      return true;
    } catch {
      return false;
    }
  }

  const token = auth.token;
  const orderId = auth.orderId;
  if (typeof token === "string" && typeof orderId === "string") {
    const order = await prisma.order.findFirst({
      where: { id: orderId, table: { qrCode: token } },
      select: { id: true },
    });
    if (!order) return false;
    socket.data.kind = "diner";
    socket.data.orderId = orderId;
    return true;
  }

  return false;
}

export function initRealtime(httpServer: HttpServer): IoServer {
  const server: IoServer = new Server(httpServer, {
    // The browser connects straight to the backend origin (not through the Next
    // rewrite), so lock the handshake to our app origin. Auth rides the socket.io
    // `auth` payload, not cookies, so no credentials needed.
    cors: { origin: ENV.APP_URL },
  });

  server.use((socket, next) => {
    authenticateSocket(socket)
      .then((ok) => next(ok ? undefined : new Error(SOCKET_AUTH_ERROR)))
      .catch((err) => {
        // An unexpected failure (e.g. the DB is briefly unreachable during the
        // diner ownership check) is not an auth rejection. Send a generic error,
        // not SOCKET_AUTH_ERROR, so the client treats it as transient and keeps
        // reconnecting rather than giving up.
        console.error("socket handshake error", err);
        next(new Error("server error"));
      });
  });

  server.on("connection", (socket) => {
    const { kind, orderId } = socket.data;
    if (kind === "staff") {
      void socket.join(STAFF_ROOM);
    } else if (kind === "diner" && typeof orderId === "string") {
      void socket.join(orderRoom(orderId));
    }
  });

  io = server;
  return server;
}

// A diner placed an order — tell the staff board so it appears with no refetch.
// The broadcast is a side effect of an already-committed write, so it must never
// throw back into the caller; a failed fan-out is logged, not propagated.
export function emitOrderNew(order: StaffOrderView): void {
  if (!io) return;
  const payload: OrderEventPayload = { order };
  try {
    io.to(STAFF_ROOM).emit(ORDER_EVENTS.new, payload);
  } catch (err) {
    console.error("emitOrderNew failed", err);
  }
}

// An order's status changed — tell the staff board and that order's diner.
export function emitOrderUpdated(order: OrderStatusView): void {
  if (!io) return;
  const payload: OrderEventPayload = { order };
  try {
    io.to(STAFF_ROOM).emit(ORDER_EVENTS.updated, payload);
    io.to(orderRoom(order.id)).emit(ORDER_EVENTS.updated, payload);
  } catch (err) {
    console.error("emitOrderUpdated failed", err);
  }
}
