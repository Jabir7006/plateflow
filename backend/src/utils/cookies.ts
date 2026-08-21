import type { CookieOptions, Response } from "express";
import { ENV } from "../config/env.js";

const { NODE_ENV } = ENV;

export const REFRESH_PATH = "/api/v1/auth/refresh";

const defaults: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "strict",
};

export const getAccessTokenCookieOptions = (): CookieOptions => {
  return {
    ...defaults,
    maxAge: 15 * 60 * 1000,
  };
};

export const getRefreshTokenCookieOptions = (): CookieOptions => {
  return {
    ...defaults,
    maxAge: 30 * 24 * 60 * 60 * 1000,
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
