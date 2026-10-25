import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  errorHandler,
  notFoundHandler,
} from "../../../src/middlewares/error.middleware.js";
import AppError from "../../../src/utils/AppError.js";
import { HTTP_STATUS } from "../../../src/constants/http.js";

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

const req = {
  path: "/api/v1/test",
  originalUrl: "/api/v1/test",
  method: "POST",
} as Request;
const next = vi.fn() as unknown as NextFunction;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("errorHandler", () => {
  it("serves an operational AppError with its message and field errors", () => {
    const res = mockResponse();
    const error = new AppError("A table with this number already exists", 409, true, [
      { field: "number", message: "A table with this number already exists" },
    ]);

    errorHandler(error, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 409,
      message: "A table with this number already exists",
      errors: [{ field: "number", message: "A table with this number already exists" }],
    });
  });

  it("turns a ZodError into a 400 with the offending field paths", () => {
    const res = mockResponse();
    const parsed = z
      .object({ body: z.object({ email: z.string() }) })
      .safeParse({ body: {} });

    errorHandler(parsed.error!, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
    const payload = res.json.mock.calls[0]![0];
    expect(payload).toMatchObject({
      success: false,
      statusCode: 400,
      message: "Validation failed",
    });
    expect(payload.errors[0].field).toBe("body.email");
  });

  it("maps JWT signature failures to 401", () => {
    const res = mockResponse();

    errorHandler(
      new jwt.JsonWebTokenError("bad signature"),
      req,
      res as unknown as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 401,
      message: "Invalid token",
    });
  });

  it("maps expired tokens to 401", () => {
    const res = mockResponse();

    errorHandler(
      new jwt.TokenExpiredError("expired", new Date()),
      req,
      res as unknown as Response,
      next
    );

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 401,
      message: "Token expired",
    });
  });

  it("reports malformed JSON as a 400 rather than a server error", () => {
    const res = mockResponse();
    const error = new SyntaxError("Unexpected token");
    (error as SyntaxError & { status: number }).status = 400;

    errorHandler(error, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 400,
      message: "Invalid JSON payload",
    });
  });

  it("hides unexpected error details outside development", () => {
    const res = mockResponse();

    errorHandler(
      new Error("connection string leaked here"),
      req,
      res as unknown as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: "Something went wrong",
    });
  });
});

describe("notFoundHandler", () => {
  it("names the route that was not found", () => {
    const res = mockResponse();

    notFoundHandler(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 404,
      message: "Route /api/v1/test not found",
    });
  });
});
