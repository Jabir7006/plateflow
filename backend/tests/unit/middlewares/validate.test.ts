import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import validate from "../../../src/middlewares/validate.middleware.js";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const run = (handler: Handler, req: Request): Promise<unknown> =>
  new Promise((resolve) => {
    void handler(req, {} as Response, resolve as NextFunction);
  });

const schema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    age: z.number().optional(),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
  }),
});

describe("validate", () => {
  it("parses and replaces the body, dropping unknown keys", async () => {
    const req = {
      body: { name: "  Soup  ", extra: "ignored" },
      query: {},
      params: {},
    } as unknown as Request;

    const error = await run(validate(schema) as unknown as Handler, req);

    expect(error).toBeUndefined();
    expect(req.body).toEqual({ name: "Soup" });
  });

  it("coerces and replaces the query object", async () => {
    const req = {
      body: { name: "Soup" },
      query: { page: "3", extra: "ignored" },
      params: {},
    } as unknown as Request;

    await run(validate(schema) as unknown as Handler, req);

    expect(req.query).toEqual({ page: 3 });
  });

  it("treats a missing body as an empty object", async () => {
    const bodyless = z.object({
      body: z.object({ note: z.string().optional() }),
    });
    const req = { query: {}, params: {} } as unknown as Request;

    const error = await run(validate(bodyless) as unknown as Handler, req);

    expect(error).toBeUndefined();
    expect(req.body).toEqual({});
  });

  it("forwards a ZodError and leaves the request untouched on failure", async () => {
    const req = {
      body: { age: 4 },
      query: {},
      params: {},
    } as unknown as Request;

    const error = await run(validate(schema) as unknown as Handler, req);

    expect(error).toBeInstanceOf(z.ZodError);
    expect(req.body).toEqual({ age: 4 });
  });

  it("does nothing when the schema returns no body or query", async () => {
    const req = {
      body: { untouched: true },
      query: { page: "1" },
      params: {},
    } as unknown as Request;

    const error = await run(validate(z.object({})) as unknown as Handler, req);

    expect(error).toBeUndefined();
    expect(req.body).toEqual({ untouched: true });
  });
});
