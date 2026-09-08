import type { CookieOptions, Response } from "express";
import { ENV } from "../config/env.js";
import { TOKEN_TTL } from "../constants/auth.js";

const { NODE_ENV } = ENV;

export const REFRESH_PATH = `/api/v1/auth/refresh`;

const defaults: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "strict",
};

export const getAccessTokenCookieOptions = (): CookieOptions => {
  return {
    ...defaults,
    maxAge: TOKEN_TTL.ACCESS,
  };
};

export const getRefreshTokenCookieOptions = (): CookieOptions => {
  return {
    ...defaults,
    maxAge: TOKEN_TTL.REFRESH,
    path: REFRESH_PATH,
  };
};

type Params = {
  res: Response;
  accessToken: string;
  refreshToken?: string;
};

export const setAuthCookies = ({ res, accessToken, refreshToken }: Params) => {
  res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());
  }
};

export const clearAuthCookies = (res: Response) => {
  return res
    .clearCookie("accessToken")
    .clearCookie("refreshToken", { path: REFRESH_PATH });
};
