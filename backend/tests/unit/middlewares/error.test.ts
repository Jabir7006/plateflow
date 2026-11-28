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
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    locals: {} as Record<string, unknown>,
  };
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

  it("maps an oversized request body to a 413", () => {
    const res = mockResponse();
    const error = new Error("request entity too large") as Error & {
      status: number;
      type: string;
    };
    error.status = HTTP_STATUS.PAYLOAD_TOO_LARGE;
    error.type = "entity.too.large";

    errorHandler(error, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.PAYLOAD_TOO_LARGE);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 413,
      message: "Request body is too large",
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

  it("redacts signup failures even when the path casing differs", () => {
    const res = mockResponse();
    const secret = "password=correct horse battery";
    const signupReq = {
      path: "/API/V1/AUTH/SIGNUP/COMPLETE",
      originalUrl: "/API/V1/AUTH/SIGNUP/COMPLETE?token=raw-link-token",
      method: "POST",
    } as Request;

    errorHandler(
      new Error(`database failed while writing ${secret}`),
      signupReq,
      res as unknown as Response,
      next
    );

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain("raw-link-token");
    expect(logged).toContain("unexpected");
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: "Something went wrong",
    });
  });

  it("redacts a marked signup mount root that the URL matcher would miss", () => {
    const res = mockResponse();
    res.locals.signupRoute = true;
    const secret = "body email owner@example.com token=raw-link-token";
    const signupReq = {
      path: "/api/v1/auth/signup",
      originalUrl: "/api/v1/auth/signup?probe=1",
      method: "POST",
    } as Request;

    errorHandler(
      new Error(`parser failed after reading ${secret}`),
      signupReq,
      res as unknown as Response,
      next
    );

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain("owner@example.com");
    expect(logged).toContain("unexpected");
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: "Something went wrong",
    });
  });

  it("keeps full diagnostics for non-signup failures", () => {
    const res = mockResponse();

    errorHandler(
      new Error("connection string leaked here"),
      req,
      res as unknown as Response,
      next
    );

    expect(console.error).toHaveBeenCalledWith(
      "Error:",
      expect.objectContaining({ message: "connection string leaked here" })
    );
    expect(console.error).toHaveBeenCalledWith(
      "Unhandled error:",
      expect.objectContaining({ message: "connection string leaked here" })
    );
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
