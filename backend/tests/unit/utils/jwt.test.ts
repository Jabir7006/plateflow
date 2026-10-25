import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import {
  accessTokenSignOptions,
  refreshTokenSignOptions,
  signToken,
  verifyRefreshToken,
  verifyToken,
  type accessTokenPayload,
  type refreshTokenPayload,
} from "../../../src/utils/jwt.js";

const accessPayload: accessTokenPayload = {
  userId: "user_1",
  restaurantId: "restaurant_1",
  role: "OWNER",
  status: "ACTIVE",
};

const refreshPayload: refreshTokenPayload = {
  userId: "user_1",
  sessionId: "session_1",
  jti: "jti_1",
};

describe("access tokens", () => {
  it("round-trips every signed claim, including the tenant", () => {
    const token = signToken(accessPayload, accessTokenSignOptions);
    const decoded = verifyToken(token) as jwt.JwtPayload;

    expect(decoded).toMatchObject(accessPayload);
    expect(decoded.exp).toBeGreaterThan(decoded.iat!);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signToken(accessPayload, { secret: "not-our-secret", expiresIn: 60 });

    expect(() => verifyToken(token)).toThrow(jwt.JsonWebTokenError);
  });

  it("rejects an expired token", () => {
    const token = signToken(accessPayload, {
      ...accessTokenSignOptions,
      expiresIn: -1,
    });

    expect(() => verifyToken(token)).toThrow(jwt.TokenExpiredError);
  });

  it("rejects a token whose signature was altered", () => {
    const token = signToken(accessPayload, accessTokenSignOptions);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

    expect(() => verifyToken(tampered)).toThrow(jwt.JsonWebTokenError);
  });
});

describe("refresh tokens", () => {
  it("round-trips the session chain claims", () => {
    const token = signToken(refreshPayload, refreshTokenSignOptions);

    expect(verifyRefreshToken(token)).toEqual(refreshPayload);
  });

  it("rejects an access token because it has no session chain", () => {
    const token = signToken(accessPayload, accessTokenSignOptions);

    expect(() => verifyRefreshToken(token)).toThrow(jwt.JsonWebTokenError);
  });

  it("rejects a refresh token signed with the access secret", () => {
    const token = signToken(refreshPayload, accessTokenSignOptions);

    expect(() => verifyRefreshToken(token)).toThrow(jwt.JsonWebTokenError);
  });

  it("rejects a refresh token whose payload is missing the jti", () => {
    const token = signToken(
      { userId: "user_1", sessionId: "session_1" } as refreshTokenPayload,
      refreshTokenSignOptions
    );

    expect(() => verifyRefreshToken(token)).toThrow(/malformed/i);
  });
});
