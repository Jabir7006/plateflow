import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import AppError from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/http.js";
import { ENV } from "../config/env.js";

const isDevelopment = ENV.NODE_ENV === "development";

// Express routing is case-insensitive by default; this matcher must be too, or
// "/API/V1/AUTH/SIGNUP/..." would take the logging path for authenticated APIs.
const SIGNUP_ROUTE = /^\/api\/v1\/auth\/signup(?:\/|$)/i;

// Signup requests are unauthenticated and their bodies carry an email, a raw
// link token and a password. Only shape-level facts may be logged.
const isSignupRequest = (req: Request): boolean =>
  SIGNUP_ROUTE.test(req.originalUrl ?? req.path);

const classifyError = (err: Error | AppError): string => {
  if (err instanceof AppError) return `app_error_${err.statusCode}`;
  if (err.name === "ZodError") return "validation";
  if (err instanceof SyntaxError) return "invalid_json";
  if (err instanceof Prisma.PrismaClientKnownRequestError)
    return `prisma_${err.code}`;
  if (err instanceof Prisma.PrismaClientValidationError)
    return "prisma_validation";
  return "unexpected";
};

const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown[]
) => {
  const body: Record<string, unknown> = {
    success: false,
    statusCode,
    message,
  };
  if (errors) body.errors = errors;
  res.status(statusCode).json(body);
};

const mapPrismaError = (err: Prisma.PrismaClientKnownRequestError) => {
  switch (err.code) {
    case "P2002":
      return {
        statusCode: HTTP_STATUS.CONFLICT,
        message: "A record with this value already exists",
      };
    case "P2025":
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: "Record not found",
      };
    case "P2003":
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: "Referenced record does not exist",
      };
    default:
      return null;
  }
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // The signup router marks res.locals before any guard runs. The URL matcher is
  // only a backstop for failures (security headers, CORS) before that router.
  const signupRequest =
    res.locals.signupRoute === true || isSignupRequest(req);

  // Log error
  if (signupRequest) {
    console.error("Signup request failed", {
      method: req.method,
      route: (req.originalUrl ?? req.path).split("?")[0],
      classification: classifyError(err),
    });
  } else {
    console.error("Error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Operational AppError — safe to expose message
  if (err instanceof AppError) {
    return sendErrorResponse(res, err.statusCode, err.message, err.errors);
  }

  // Zod validation errors

  if (err.name === "ZodError" && "issues" in err) {
    const formattedErrors = (
      err as Error & {
        issues: Array<{ path: (string | number)[]; message: string }>;
      }
    ).issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Validation failed",
      formattedErrors
    );
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    if (mapped) {
      return sendErrorResponse(res, mapped.statusCode, mapped.message);
    }
  }

  // Body-parser rejects a body larger than the configured limit before any
  // route runs. Without this branch it would fall through as a 500.
  if ("status" in err && err.status === HTTP_STATUS.PAYLOAD_TOO_LARGE) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      "Request body is too large"
    );
  }

  // Invalid JSON body from express.json()
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return sendErrorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid JSON payload"
    );
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return sendErrorResponse(res, HTTP_STATUS.UNAUTHORIZED, "Invalid token");
  }
  if (err.name === "TokenExpiredError") {
    return sendErrorResponse(res, HTTP_STATUS.UNAUTHORIZED, "Token expired");
  }

  // Unknown/unexpected errors. Signup already logged a shape-only classification
  // above and must never receive the raw message, even in development: parser
  // and database errors can embed the submitted body or a connection string.
  if (!signupRequest) console.error("Unhandled error:", err);
  return sendErrorResponse(
    res,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isDevelopment && !signupRequest ? err.message : "Something went wrong"
  );
};

export const notFoundHandler = (req: Request, res: Response) => {
  sendErrorResponse(
    res,
    HTTP_STATUS.NOT_FOUND,
    `Route ${req.originalUrl} not found`
  );
};
