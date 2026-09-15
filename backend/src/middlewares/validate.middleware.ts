import { z } from "zod";
import catchAsync from "../utils/catchAsync.js";

const validate = (schema: z.ZodType) => {
  return catchAsync(async (req, _res, next) => {
    const parsed = await schema.parseAsync({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });

    if (parsed !== null && typeof parsed === "object" && "body" in parsed) {
      req.body = (parsed as { body: unknown }).body;
    }

    return next();
  });
};

export default validate;
