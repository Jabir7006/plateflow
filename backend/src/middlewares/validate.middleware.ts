import type { Request } from "express";
import { z } from "zod";
import catchAsync from "../utils/catchAsync.js";

const override = (req: Request, key: "query", value: unknown): void => {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

const validate = (schema: z.ZodType) => {
  return catchAsync(async (req, _res, next) => {
    const parsed = (await schema.parseAsync({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    })) as { body?: unknown; query?: unknown };

    if (parsed === null || typeof parsed !== "object") {
      return next();
    }

    if ("body" in parsed) {
      req.body = parsed.body;
    }

    if ("query" in parsed) {
      override(req, "query", parsed.query);
    }

    return next();
  });
};

export default validate;
