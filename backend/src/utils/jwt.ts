import jwt, { type SignOptions, type VerifyOptions } from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { User } from "../generated/prisma/client.js";
import { TOKEN_TTL } from "../constants/auth.js";

const { REFRESH_TOKEN_SECRET, ACCESS_TOKEN_SECRET } = ENV;

export type refreshTokenPayload = {
  userId: User["id"];
  sessionId: string;
  jti: string;
};

export type accessTokenPayload = {
  userId: User["id"];
  role: User["role"];
  status: User["status"];
};

type signOptionsAndSecret = SignOptions & {
  secret: string;
};

export const accessTokenSignOptions: signOptionsAndSecret = {
  secret: ACCESS_TOKEN_SECRET,
  expiresIn: TOKEN_TTL.ACCESS / 1000,
};

export const refreshTokenSignOptions: signOptionsAndSecret = {
  secret: REFRESH_TOKEN_SECRET,
  expiresIn: TOKEN_TTL.REFRESH / 1000,
};

export const signToken = (
  payload: accessTokenPayload | refreshTokenPayload,
  options?: signOptionsAndSecret
) => {
  const { secret, ...rest } = options || accessTokenSignOptions;
  return jwt.sign(payload, secret, { ...rest });
};

export const verifyToken = (
  token: string,
  options?: VerifyOptions & {
    secret: string;
  }
) => {
  const { secret = ACCESS_TOKEN_SECRET, ...verifyOpts } = options || {};

  const decoded = jwt.verify(token, secret, { ...verifyOpts });

  return decoded;
};

export const verifyRefreshToken = (token: string): refreshTokenPayload => {
  const decoded = verifyToken(token, { secret: REFRESH_TOKEN_SECRET });

  if (typeof decoded === "string") {
    throw new jwt.JsonWebTokenError("Refresh token payload is not an object");
  }

  const { userId, sessionId, jti } = decoded as Partial<refreshTokenPayload>;

  if (
    typeof userId !== "string" ||
    typeof sessionId !== "string" ||
    typeof jti !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Refresh token payload is malformed");
  }

  return { userId, sessionId, jti };
};
