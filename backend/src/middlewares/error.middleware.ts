import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import AppError from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/http.js";
import { ENV } from "../config/env.js";

const isDevelopment = ENV.NODE_ENV === "development";

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
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error
  console.error("Error:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Operational AppError — safe to expose message
  if (err instanceof AppError) {
    return sendErrorResponse(res, err.statusCode, err.message, err.errors);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
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

  // Unknown/unexpected errors — log full stack, expose generic message to client
  console.error("Unhandled error:", err);
  return sendErrorResponse(
    res,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isDevelopment ? err.message : "Something went wrong"
  );
};

export const notFoundHandler = (req: Request, res: Response) => {
  sendErrorResponse(
    res,
    HTTP_STATUS.NOT_FOUND,
    `Route ${req.originalUrl} not found`
  );
};
