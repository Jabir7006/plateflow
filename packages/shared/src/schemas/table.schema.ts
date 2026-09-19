import { z } from "zod";

const requiredId = (label: string) =>
  z.string(`${label} id is required`).trim().min(1, `${label} id is required`);

const tableParamId = requiredId("Table");

// A table number is a small positive integer the restaurant assigns. This
// ceiling catches typos long before it matters; the column is a plain Int.
const MAX_TABLE_NUMBER = 100_000;

// Only whole digits — a table number is never "12.5", "1e3" or "0x4".
const WHOLE_NUMBER = /^\d+$/;

// The number reaches the API as a JSON number and the web form as the raw text
// of an input, so both are normalised to a number before the shared rules run.
// The rules are what matter: a positive whole number within a sane ceiling.
const tableNumber = z
  .union([z.number(), z.string().trim().min(1)], "Table number is required")
  .transform((value) => {
    if (typeof value === "number") return value;
    const raw = value.trim();
    return WHOLE_NUMBER.test(raw) ? Number(raw) : Number.NaN;
  })
  .pipe(
    z
      .number("Enter a table number, for example 12")
      .int("Table number must be a whole number")
      .positive("Table number must be greater than 0")
      .max(MAX_TABLE_NUMBER, "Table number looks too large"),
  );

export const createTableSchema = z.object({
  body: z.object({ number: tableNumber }),
});

export const updateTableSchema = z.object({
  params: z.object({ id: tableParamId }),
  body: z.object({ number: tableNumber }),
});

export const tableIdSchema = z.object({
  params: z.object({ id: tableParamId }),
});

export type CreateTableSchema = z.infer<typeof createTableSchema>;
export type UpdateTableSchema = z.infer<typeof updateTableSchema>;
export type TableIdSchema = z.infer<typeof tableIdSchema>;
