import jwt, { type SignOptions, type VerifyOptions } from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { User } from "../generated/prisma/client.js";

const { REFRESH_TOKEN_SECRET, ACCESS_TOKEN_SECRET } = ENV;

export type refreshTokenPayload = {
  userId: User["id"];
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
  expiresIn: "15m",
};

export const refreshTokenSignOptions: signOptionsAndSecret = {
  secret: REFRESH_TOKEN_SECRET,
  expiresIn: "30d",
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
