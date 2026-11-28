import type { Request } from "express";
import type {
  AcceptInviteSchema,
  SignupCompleteSchema,
  SignupRequestSchema,
  SignupVerifySchema,
  VerifyInviteSchema,
} from "@plateflow/shared";
import jwt from "jsonwebtoken";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import authService, { type SessionContext } from "./auth.service.js";
import {
  OWNER_SIGNUP_REQUEST_MESSAGE,
  previewOwnerSignup,
  requestOwnerSignup,
} from "./owner-signup.service.js";

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

export const verifyInvite = catchAsync(async (req, res) => {
  const { token } = req.query as VerifyInviteSchema["query"];

  const invite = await authService.verifyInvite(token);

  // The token is a credential and it travels in the URL, so nothing on the path
  // may keep a copy of this response.
  res.set("Cache-Control", "no-store");

  sendResponse(res, HTTP_STATUS.SUCCESS, invite, "Invitation is valid");
});

export const acceptInvite = catchAsync(async (req, res) => {
  const { token, password } = req.body as AcceptInviteSchema["body"];

  const { user, accessToken, refreshToken } = await authService.acceptInvite(
    token,
    password,
    sessionContextFrom(req)
  );

  setAuthCookies({ res, accessToken, refreshToken });

  sendResponse(res, HTTP_STATUS.CREATED, user, "Invitation accepted");
});

// Only a rejected credential is worth discarding cookies for. A 5xx leaves the
// refresh token valid in the database, so clearing would log the user out for
// the duration of a database blip. A 409 is excluded too: a sibling request is
// rotating this session, so the winner's cookies must survive this response.
//
// JWT failures count as rejections even though they are not AppErrors — they
// surface from verifyRefreshToken and are served as 401 by the error middleware.
const isCredentialRejection = (error: unknown): boolean =>
  error instanceof jwt.JsonWebTokenError ||
  (error instanceof AppError &&
    (error.statusCode === HTTP_STATUS.UNAUTHORIZED ||
      error.statusCode === HTTP_STATUS.FORBIDDEN));

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;

  try {
    if (!token) {
      throw new AppError("Refresh token missing", HTTP_STATUS.UNAUTHORIZED);
    }

    const { user, accessToken, refreshToken } =
      await authService.refreshSession(token, sessionContextFrom(req));

    setAuthCookies({ res, accessToken, refreshToken });

    sendResponse(res, HTTP_STATUS.SUCCESS, user, "Session refreshed");
  } catch (error) {
    if (isCredentialRejection(error)) {
      clearAuthCookies(res);
    }

    throw error;
  }
});

export const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  let revocationError: unknown = null;

  if (token) {
    try {
      await authService.logoutCurrentSession(token);
    } catch (error) {
      const isUnusableToken =
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError;

      if (!isUnusableToken) {
        revocationError = error;
      }
    }
  }

  // Surrender this browser's credentials even when revocation failed. Otherwise a
  // logout the server did receive would leave the device able to resume the
  // session on the next reload, while the user believes they signed out.
  clearAuthCookies(res);

  if (revocationError) {
    throw revocationError;
  }

  sendResponse(res, HTTP_STATUS.SUCCESS, null, "Logged out successfully");
});

export const getMe = catchAsync(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await authService.getMe(req.user.userId);

  sendResponse(res, HTTP_STATUS.SUCCESS, user, "User fetched successfully");
});

// The three signup handlers are deliberately identical in shape to the invite
// handlers: validate in the route, keep provider latency out of the response,
// and write cookies only after the transaction committed.

export const requestSignup = catchAsync(async (req, res) => {
  const { email } = req.body as SignupRequestSchema["body"];

  await requestOwnerSignup(email);

  // Same status, body and message for new addresses, existing accounts,
  // suppressed resends and accepted delivery attempts.
  sendResponse(
    res,
    HTTP_STATUS.ACCEPTED,
    null,
    OWNER_SIGNUP_REQUEST_MESSAGE
  );
});

export const verifySignup = catchAsync(async (req, res) => {
  const { token } = req.body as SignupVerifySchema["body"];

  const preview = await previewOwnerSignup(token);

  sendResponse(res, HTTP_STATUS.SUCCESS, preview, "Signup link is valid");
});

export const completeSignup = catchAsync(async (req, res) => {
  const body = req.body as SignupCompleteSchema["body"];

  const { user, accessToken, refreshToken } =
    await authService.completeOwnerSignup(body, sessionContextFrom(req));

  // The account exists and the transaction committed: only now may the browser
  // receive the session the same transaction created.
  setAuthCookies({ res, accessToken, refreshToken });

  sendResponse(res, HTTP_STATUS.CREATED, user, "Restaurant created");
});
