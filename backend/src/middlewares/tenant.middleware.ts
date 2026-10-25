import type { NextFunction, Request, Response } from "express";
import AppError from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/http.js";

// Runs after `authenticate`. Stamps the request with the tenant from the signed
// access token, which is the only source of truth — the client never sends one.
//
// Fails closed: a session with no restaurant would otherwise run every query
// unscoped, so it is rejected outright. This should be unreachable once the
// contract migration makes User.restaurantId NOT NULL; it is the runtime guard
// for the window before that and for any malformed token.
export const tenantContext = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(
      new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED)
    );
  }

  if (typeof req.user.restaurantId !== "string" || !req.user.restaurantId) {
    return next(
      new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED)
    );
  }

  req.restaurantId = req.user.restaurantId;
  return next();
};

// A non-null assertion with a message, for controllers behind `tenantContext`.
// Throwing here rather than silently defaulting keeps a wiring mistake loud.
export const requireTenant = (req: Request): string => {
  if (!req.restaurantId) {
    throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  return req.restaurantId;
};
