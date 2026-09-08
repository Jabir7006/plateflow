import type { Request } from "express";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import authService, {
  ConcurrentRefreshError,
  type SessionContext,
} from "./auth.service.js";

const sessionContextFrom = (req: Request): SessionContext => ({
  device: req.headers["user-agent"],
  ip: req.ip,
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } = await authService.login(
    { body: { email, password } },
    sessionContextFrom(req)
  );

  setAuthCookies({ res, accessToken, refreshToken });

  sendResponse(res, HTTP_STATUS.SUCCESS, user, "Login successful");
});

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    throw new AppError("Refresh token missing", HTTP_STATUS.UNAUTHORIZED);
  }

  try {
    const { user, accessToken, refreshToken } =
      await authService.refreshSession(token, sessionContextFrom(req));

    setAuthCookies({ res, accessToken, refreshToken });

    sendResponse(res, HTTP_STATUS.SUCCESS, user, "Session refreshed");
  } catch (error) {
    if (!(error instanceof ConcurrentRefreshError)) {
      clearAuthCookies(res);
    }

    throw error;
  }
});

export const getMe = catchAsync(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await authService.getMe(req.user.userId);

  sendResponse(res, HTTP_STATUS.SUCCESS, user, "User fetched successfully");
});
