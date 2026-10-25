import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { authenticate, requireRole } from "../../../src/modules/auth/auth.middleware.js";
import AppError from "../../../src/utils/AppError.js";
import { HTTP_STATUS } from "../../../src/constants/http.js";
import { accessTokenSignOptions, signToken } from "../../../src/utils/jwt.js";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

// catchAsync handlers report their outcome through `next`, so resolving the
// promise with next's first argument turns them into something awaitable.
const run = (handler: Handler, req: Request): Promise<unknown> =>
  new Promise((resolve) => {
    void handler(req, {} as Response, resolve as NextFunction);
  });

const validToken = () =>
  signToken({
    userId: "user_1",
    restaurantId: "restaurant_1",
    role: "OWNER",
    status: "ACTIVE",
  });

describe("authenticate", () => {
  it("rejects a request with no access cookie", async () => {
    const req = { cookies: {} } as unknown as Request;

    const error = await run(authenticate, req);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(req.user).toBeUndefined();
  });

  it("accepts a valid token and exposes its claims on the request", async () => {
    const req = { cookies: { accessToken: validToken() } } as unknown as Request;

    const error = await run(authenticate, req);

    expect(error).toBeUndefined();
    expect(req.user).toMatchObject({
      userId: "user_1",
      restaurantId: "restaurant_1",
      role: "OWNER",
      status: "ACTIVE",
    });
  });

  it("rejects a token that does not verify", async () => {
    const req = { cookies: { accessToken: "not-a-jwt" } } as unknown as Request;

    const error = await run(authenticate, req);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect((error as AppError).message).toBe("Invalid or expired token");
  });

  it("rejects an expired token", async () => {
    const expired = signToken(
      {
        userId: "user_1",
        restaurantId: "restaurant_1",
        role: "OWNER",
        status: "ACTIVE",
      },
      { ...accessTokenSignOptions, expiresIn: -1 }
    );
    const req = { cookies: { accessToken: expired } } as unknown as Request;

    const error = await run(authenticate, req);

    expect((error as AppError).statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("rejects a legacy token that carries no tenant", async () => {
    const legacy = signToken({
      userId: "user_1",
      role: "OWNER",
      status: "ACTIVE",
    } as never);
    const req = { cookies: { accessToken: legacy } } as unknown as Request;

    const error = await run(authenticate, req);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(req.user).toBeUndefined();
  });
});

describe("requireRole", () => {
  it("rejects an unauthenticated request", async () => {
    const handler = requireRole("OWNER") as unknown as Handler;

    const error = await run(handler, {} as Request);

    expect((error as AppError).statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("allows a role in the allow-list", async () => {
    const req = {
      user: {
        userId: "u",
        restaurantId: "r",
        role: "MANAGER",
        status: "ACTIVE",
      },
    } as unknown as Request;

    const error = await run(requireRole("OWNER", "MANAGER") as unknown as Handler, req);

    expect(error).toBeUndefined();
  });

  it("forbids a staff member whose role is not allowed", async () => {
    const req = {
      user: {
        userId: "u",
        restaurantId: "r",
        role: "WAITER",
        status: "ACTIVE",
      },
    } as unknown as Request;

    const error = await run(requireRole("OWNER", "MANAGER") as unknown as Handler, req);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect((error as AppError).message).toBe("Insufficient permissions");
  });
});
