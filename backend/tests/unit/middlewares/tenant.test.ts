import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  requireTenant,
  tenantContext,
} from "../../../src/middlewares/tenant.middleware.js";
import AppError from "../../../src/utils/AppError.js";
import { HTTP_STATUS } from "../../../src/constants/http.js";

const next = () => vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;

describe("tenantContext", () => {
  it("rejects an unauthenticated request", () => {
    const req = {} as Request;
    const done = next();

    tenantContext(req, {} as Response, done);

    expect(done).toHaveBeenCalledTimes(1);
    const error = done.mock.calls[0]![0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(req.restaurantId).toBeUndefined();
  });

  it("fails closed when the session carries no restaurant", () => {
    const req = {
      user: { userId: "u", role: "OWNER", status: "ACTIVE" },
    } as unknown as Request;
    const done = next();

    tenantContext(req, {} as Response, done);

    const error = (done.mock.calls[0] as unknown[])[0] as AppError;
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(req.restaurantId).toBeUndefined();
  });

  it("stamps the tenant from the signed session onto the request", () => {
    const req = {
      user: {
        userId: "u",
        restaurantId: "restaurant_1",
        role: "OWNER",
        status: "ACTIVE",
      },
    } as unknown as Request;
    const done = next();

    tenantContext(req, {} as Response, done);

    expect(done).toHaveBeenCalledWith();
    expect(req.restaurantId).toBe("restaurant_1");
  });
});

describe("requireTenant", () => {
  it("returns the tenant that tenantContext established", () => {
    const req = { restaurantId: "restaurant_1" } as Request;

    expect(requireTenant(req)).toBe("restaurant_1");
  });

  it("throws loudly when a scoped route is wired without tenantContext", () => {
    expect(() => requireTenant({} as Request)).toThrowError(AppError);
    expect(() => requireTenant({} as Request)).toThrowError(/Authentication required/);
  });
});
