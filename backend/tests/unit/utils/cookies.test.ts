import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { TOKEN_TTL } from "../../../src/constants/auth.js";
import {
  AUTH_PATH,
  clearAuthCookies,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  setAuthCookies,
} from "../../../src/utils/cookies.js";

const API_PATH = "/api/v1";
const LEGACY_REFRESH_PATH = `${AUTH_PATH}/refresh`;

function mockResponse() {
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };

  res.cookie.mockReturnValue(res);
  res.clearCookie.mockReturnValue(res);

  return res as unknown as Response & typeof res;
}

describe("cookie options", () => {
  it("marks the access cookie httpOnly, strict and scoped to the API", () => {
    expect(getAccessTokenCookieOptions()).toEqual({
      httpOnly: true,
      secure: false, // NODE_ENV=test
      sameSite: "strict",
      maxAge: TOKEN_TTL.ACCESS,
      path: API_PATH,
    });
  });

  it("scopes the refresh cookie to the auth routes", () => {
    expect(getRefreshTokenCookieOptions()).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: TOKEN_TTL.REFRESH,
      path: AUTH_PATH,
    });
  });
});

describe("setAuthCookies", () => {
  it("sets both cookies and evicts the legacy access paths", () => {
    const res = mockResponse();

    setAuthCookies({ res, accessToken: "access", refreshToken: "refresh" });

    expect(res.clearCookie).toHaveBeenCalledWith("accessToken", { path: "/" });
    expect(res.clearCookie).toHaveBeenCalledWith("accessToken", { path: AUTH_PATH });
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
      path: LEGACY_REFRESH_PATH,
    });

    expect(res.cookie).toHaveBeenCalledWith(
      "accessToken",
      "access",
      expect.objectContaining({ httpOnly: true, path: API_PATH })
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "refreshToken",
      "refresh",
      expect.objectContaining({ httpOnly: true, path: AUTH_PATH })
    );
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  it("leaves the refresh cookie untouched when no refresh token is issued", () => {
    const res = mockResponse();

    setAuthCookies({ res, accessToken: "access" });

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      "accessToken",
      "access",
      expect.anything()
    );
    expect(res.clearCookie).not.toHaveBeenCalledWith(
      "refreshToken",
      expect.anything()
    );
  });
});

describe("clearAuthCookies", () => {
  it("clears every path a credential may have been stored under", () => {
    const res = mockResponse();

    clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledWith("accessToken", { path: API_PATH });
    expect(res.clearCookie).toHaveBeenCalledWith("accessToken", { path: AUTH_PATH });
    expect(res.clearCookie).toHaveBeenCalledWith("accessToken", { path: "/" });
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", { path: AUTH_PATH });
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
      path: LEGACY_REFRESH_PATH,
    });
    expect(res.clearCookie).toHaveBeenCalledTimes(5);
  });
});
