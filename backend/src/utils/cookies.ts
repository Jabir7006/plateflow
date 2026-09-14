import type { CookieOptions, Response } from "express";
import { ENV } from "../config/env.js";
import { TOKEN_TTL } from "../constants/auth.js";

const { NODE_ENV } = ENV;

export const AUTH_PATH = `/api/v1/auth`;
const LEGACY_REFRESH_PATH = `${AUTH_PATH}/refresh`;
const API_PATH = `/api/v1`;

const defaults: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "strict",
};

export const getAccessTokenCookieOptions = (): CookieOptions => {
  return {
    ...defaults,
    maxAge: TOKEN_TTL.ACCESS,
    path: API_PATH,
  };
};

export const getRefreshTokenCookieOptions = (): CookieOptions => {
  return {
    ...defaults,
    maxAge: TOKEN_TTL.REFRESH,
    path: AUTH_PATH,
  };
};

type Params = {
  res: Response;
  accessToken: string;
  refreshToken?: string;
};

// TODO: remove once the cookie-path migration is done — i.e. once the longest
// session that could hold a legacy path (SESSION_ABSOLUTE, 90 days) has expired.
// The extra clearCookie calls below exist only to evict cookies set under the
// old paths, and they ship on every login and refresh until removed.
export const setAuthCookies = ({ res, accessToken, refreshToken }: Params) => {
  res
    .clearCookie("accessToken", { path: "/" })
    .clearCookie("accessToken", { path: AUTH_PATH })
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions());

  if (refreshToken) {
    res
      .clearCookie("refreshToken", { path: LEGACY_REFRESH_PATH })
      .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());
  }
};

export const clearAuthCookies = (res: Response) => {
  return res
    .clearCookie("accessToken", { path: API_PATH })
    .clearCookie("accessToken", { path: AUTH_PATH })
    .clearCookie("accessToken", { path: "/" })
    .clearCookie("refreshToken", { path: AUTH_PATH })
    .clearCookie("refreshToken", { path: LEGACY_REFRESH_PATH });
};
