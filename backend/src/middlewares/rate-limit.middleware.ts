import rateLimit, { type Options } from "express-rate-limit";
import { ENV } from "../config/env.js";
import { HTTP_STATUS } from "../constants/http.js";

// Abuse protection for the public surface. Limits are environment-driven and
// off by default outside production, so local development and the test suite
// never have to fight a 429. The in-memory store is per process; if the API is
// ever scaled horizontally, replace it with a shared store (e.g. Redis) or each
// instance will enforce its own quota.

interface RateLimiterConfig {
  enabled: boolean;
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
}

const tooManyRequests: Options["handler"] = (_request, response) => {
  response.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: "Too many requests. Please wait a moment and try again.",
  });
};

export function createRateLimiter({
  enabled,
  windowMs,
  limit,
  skipSuccessfulRequests = false,
}: RateLimiterConfig) {
  return rateLimit({
    windowMs,
    limit,
    // A disabled limiter still passes through the same code path; it just never
    // records or blocks a request.
    skip: () => !enabled,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: tooManyRequests,
  });
}

// Public reads: the QR menu and an order's status. A diner checks these a
// handful of times; realtime updates arrive over the socket, not by polling.
export const publicReadLimiter = createRateLimiter({
  enabled: ENV.RATE_LIMIT_ENABLED,
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.RATE_LIMIT_PUBLIC_MAX,
});

// Public writes: placing an order. Tighter than reads because each one creates
// a row and notifies staff.
export const publicWriteLimiter = createRateLimiter({
  enabled: ENV.RATE_LIMIT_ENABLED,
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.RATE_LIMIT_WRITE_MAX,
});

// Credential and invitation endpoints. Successful requests are not counted, so
// a staff member logging in on several devices or refreshing a session is not
// punished; repeated failures are.
export const authLimiter = createRateLimiter({
  enabled: ENV.RATE_LIMIT_ENABLED,
  windowMs: ENV.RATE_LIMIT_AUTH_WINDOW_MS,
  limit: ENV.RATE_LIMIT_AUTH_MAX,
  skipSuccessfulRequests: true,
});
