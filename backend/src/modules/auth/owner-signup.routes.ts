import express, { Router, type RequestHandler } from "express";
import {
  signupCompleteSchema,
  signupRequestSchema,
  signupVerifySchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import {
  signupLinkLimiter,
  signupRequestLimiter,
} from "../../middlewares/rate-limit.middleware.js";
import { ENV } from "../../config/env.js";
import { HTTP_STATUS } from "../../constants/http.js";
import AppError from "../../utils/AppError.js";
import {
  completeSignup,
  requestSignup,
  verifySignup,
} from "./auth.controller.js";

// Self-serve signup is mounted before the global JSON parsers so that cache,
// feature-flag, origin and content-type checks run even for malformed or
// oversized bodies. The guards are read once at import.
const router = Router();

const APP_ORIGIN = new URL(ENV.APP_URL).origin;

const signupNoStore: RequestHandler = (_req, res, next) => {
  // Mark the request before any guard can fail. The error handler cannot rely
  // on the raw URL alone: Express routing is case-insensitive and a query string
  // on the mount root does not match the path regex.
  res.locals.signupRoute = true;
  // Tokens and email addresses travel through these routes; nothing may cache
  // them, including error responses.
  res.set("Cache-Control", "no-store");
  next();
};

const signupEnabled: RequestHandler = (_req, _res, next) => {
  if (!ENV.SELF_SERVE_SIGNUP_ENABLED) {
    // Not "disabled": a probe should not be able to tell the feature exists.
    return next(new AppError("Not found", HTTP_STATUS.NOT_FOUND));
  }
  next();
};

const signupOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin;
  if (origin === undefined) return next();

  let supplied: string;
  try {
    supplied = new URL(origin).origin;
  } catch {
    return next(
      new AppError("Request origin is not allowed", HTTP_STATUS.FORBIDDEN)
    );
  }

  if (supplied !== APP_ORIGIN) {
    return next(
      new AppError("Request origin is not allowed", HTTP_STATUS.FORBIDDEN)
    );
  }

  next();
};

const signupJsonOnly: RequestHandler = (req, _res, next) => {
  if (!req.is("application/json")) {
    return next(
      new AppError(
        "Content-Type must be application/json",
        HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE
      )
    );
  }
  next();
};

router.use(signupNoStore, signupEnabled, signupOrigin, signupJsonOnly);
router.use(express.json({ limit: ENV.JSON_BODY_LIMIT }));

// Guest-accessible by design: no authenticate/tenant middleware runs here.
router.post(
  "/request",
  signupRequestLimiter,
  validate(signupRequestSchema),
  requestSignup
);
router.post(
  "/verify",
  signupLinkLimiter,
  validate(signupVerifySchema),
  verifySignup
);
router.post(
  "/complete",
  signupLinkLimiter,
  validate(signupCompleteSchema),
  completeSignup
);

export default router;
