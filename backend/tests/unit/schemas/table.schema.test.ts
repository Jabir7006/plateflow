import { describe, expect, it } from "vitest";
import {
  createTableSchema,
  tableIdSchema,
  updateTableSchema,
} from "@plateflow/shared";

const messageOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("table numbers", () => {
  it("coerces a trimmed whole-number string", () => {
    expect(createTableSchema.parse({ body: { number: " 12 " } }).body.number).toBe(12);
    expect(createTableSchema.parse({ body: { number: 7 } }).body.number).toBe(7);
  });

  it.each([
    ["zero", 0],
    ["negative", -3],
    ["decimal number", 12.5],
    ["decimal string", "12.5"],
    ["exponent string", "1e3"],
    ["hex string", "0x4"],
    ["blank string", "   "],
    ["over the ceiling", 100_001],
  ])("rejects a %s table number", (_label, number) => {
    expect(createTableSchema.safeParse({ body: { number } }).success).toBe(false);
  });

  it("reports the whole-number rule for a decimal", () => {
    const result = createTableSchema.safeParse({ body: { number: 12.5 } });

    expect(messageOf(result)).toBe("Table number must be a whole number");
  });

  it("applies the same rules on update", () => {
    expect(
      updateTableSchema.safeParse({
        params: { id: "table_1" },
        body: { number: "3" },
      }).success
    ).toBe(true);
    expect(
      updateTableSchema.safeParse({
        params: { id: "table_1" },
        body: { number: 0 },
      }).success
    ).toBe(false);
  });
});

describe("table ids", () => {
  it("requires a non-empty id and trims it", () => {
    expect(tableIdSchema.parse({ params: { id: " table_1 " } }).params.id).toBe(
      "table_1"
    );
    expect(tableIdSchema.safeParse({ params: { id: "   " } }).success).toBe(false);
  });
});
