import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  signWsTicket,
  verifyWsTicket,
  type TicketPayload,
} from "../../../src/realtime/ticket.js";
import {
  accessTokenSignOptions,
  refreshTokenSignOptions,
  signToken,
} from "../../../src/utils/jwt.js";

const payload: TicketPayload = {
  userId: "user_1",
  restaurantId: "restaurant_1",
  role: "WAITER",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("realtime tickets", () => {
  it("round-trips the identity the socket needs", () => {
    expect(verifyWsTicket(signWsTicket(payload))).toEqual(payload);
  });

  it("cannot be satisfied by a session access token", () => {
    const accessToken = signToken(
      {
        userId: payload.userId,
        restaurantId: payload.restaurantId,
        role: payload.role,
        status: "ACTIVE",
      },
      accessTokenSignOptions
    );

    expect(() => verifyWsTicket(accessToken)).toThrow(jwt.JsonWebTokenError);
  });

  it("cannot be satisfied by a refresh token", () => {
    const refreshToken = signToken(
      { userId: payload.userId, sessionId: "session_1", jti: "jti_1" },
      refreshTokenSignOptions
    );

    expect(() => verifyWsTicket(refreshToken)).toThrow(jwt.JsonWebTokenError);
  });

  it("rejects a tampered ticket", () => {
    const ticket = signWsTicket(payload);
    const tampered = ticket.slice(0, -1) + (ticket.endsWith("a") ? "b" : "a");

    expect(() => verifyWsTicket(tampered)).toThrow(jwt.JsonWebTokenError);
  });

  it("expires after its short handshake window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const ticket = signWsTicket(payload);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));

    expect(() => verifyWsTicket(ticket)).toThrow(jwt.TokenExpiredError);
  });
});
