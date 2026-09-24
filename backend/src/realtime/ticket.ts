import { createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import type { Role } from "../generated/prisma/enums.js";

// The httpOnly, sameSite=strict, /api/v1-scoped access cookie can't ride a
// cross-origin socket.io handshake, so an authenticated staffer exchanges their
// session for one of these short-lived tickets (GET /api/v1/realtime/ticket) and
// hands it to socket.io in the connection `auth`. It carries only what the socket
// layer needs and is verified there before the socket joins the staff room.
//
// Signed with a key *derived* from the access-token secret (HMAC with a fixed
// label), not the secret itself. That domain separation means a ticket can't be
// verified as an access token and an access token can't be verified as a ticket
// — the keys differ — so neither can stand in for the other. The `purpose` claim
// stays as a readable, secondary guard.
const TICKET_SECRET = createHmac("sha256", ENV.ACCESS_TOKEN_SECRET)
  .update("plateflow:ws-ticket:v1")
  .digest("hex");
const TICKET_TTL_SECONDS = 60;
const TICKET_PURPOSE = "ws-ticket";

export interface TicketPayload {
  userId: string;
  role: Role;
}

export function signWsTicket(payload: TicketPayload): string {
  return jwt.sign({ ...payload, purpose: TICKET_PURPOSE }, TICKET_SECRET, {
    expiresIn: TICKET_TTL_SECONDS,
  });
}

export function verifyWsTicket(ticket: string): TicketPayload {
  const decoded = jwt.verify(ticket, TICKET_SECRET);

  if (typeof decoded === "string" || decoded.purpose !== TICKET_PURPOSE) {
    throw new jwt.JsonWebTokenError("Not a realtime ticket");
  }

  const { userId, role } = decoded as Partial<TicketPayload>;
  if (typeof userId !== "string" || typeof role !== "string") {
    throw new jwt.JsonWebTokenError("Realtime ticket payload is malformed");
  }

  return { userId, role };
}
