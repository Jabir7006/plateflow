import { describe, expect, it } from "vitest";
import {
  createMenuCategorySchema,
  createMenuItemSchema,
  listMenuItemsSchema,
  updateMenuItemSchema,
} from "@plateflow/shared";

const messageOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

const baseItem = { name: "Soup", price: 10, categoryId: "category_1" };

describe("createMenuCategorySchema", () => {
  it("trims and bounds the category name", () => {
    expect(
      createMenuCategorySchema.parse({ body: { name: "  Starters  " } }).body.name
    ).toBe("Starters");

    expect(
      createMenuCategorySchema.safeParse({ body: { name: "A" } }).success
    ).toBe(false);
    expect(
      createMenuCategorySchema.safeParse({ body: { name: "x".repeat(61) } }).success
    ).toBe(false);
  });
});

describe("createMenuItemSchema prices", () => {
  it("normalises numeric strings into numbers", () => {
    const parsed = createMenuItemSchema.parse({
      body: { ...baseItem, price: " 250.50 " },
    });

    expect(parsed.body.price).toBe(250.5);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["three-decimal number", 12.345],
    ["exponent string", "1e5"],
    ["comma decimal string", "12,50"],
    ["hex string", "0x1F"],
    ["blank string", ""],
    ["over the ceiling", 1_000_001],
  ])("rejects a %s price", (_label, price) => {
    expect(
      createMenuItemSchema.safeParse({ body: { ...baseItem, price } }).success
    ).toBe(false);
  });

  it("reports the money-precision rule for a three-decimal number", () => {
    const result = createMenuItemSchema.safeParse({
      body: { ...baseItem, price: 12.345 },
    });

    expect(messageOf(result)).toBe("Price can have at most 2 decimal places");
  });
});

describe("createMenuItemSchema sizes", () => {
  it("accepts sizes and keeps their order", () => {
    const parsed = createMenuItemSchema.parse({
      body: {
        ...baseItem,
        sizes: [
          { label: "Large", price: 15 },
          { label: "Small", price: 8 },
        ],
      },
    });

    expect(parsed.body.sizes?.map((size) => size.label)).toEqual(["Large", "Small"]);
  });

  it("rejects duplicate labels regardless of case", () => {
    const result = createMenuItemSchema.safeParse({
      body: {
        ...baseItem,
        sizes: [
          { label: "Large", price: 15 },
          { label: "large", price: 12 },
        ],
      },
    });

    expect(messageOf(result)).toBe("Each size needs a different label");
  });

  it("caps the number of sizes", () => {
    const result = createMenuItemSchema.safeParse({
      body: {
        ...baseItem,
        sizes: Array.from({ length: 9 }, (_, index) => ({
          label: `Size ${index}`,
          price: 10,
        })),
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("createMenuItemSchema fields", () => {
  it("defaults availability to undefined so the column default applies", () => {
    const parsed = createMenuItemSchema.parse({ body: baseItem });

    expect(parsed.body.isAvailable).toBeUndefined();
    expect(parsed.body.description).toBeUndefined();
  });

  it("turns an empty description into null", () => {
    const parsed = createMenuItemSchema.parse({
      body: { ...baseItem, description: "   " },
    });

    expect(parsed.body.description).toBeNull();
  });

  it("trims the item name and enforces its length", () => {
    expect(
      createMenuItemSchema.parse({ body: { ...baseItem, name: "  Soup  " } }).body
        .name
    ).toBe("Soup");

    expect(
      createMenuItemSchema.safeParse({ body: { ...baseItem, name: "A" } }).success
    ).toBe(false);
    expect(
      createMenuItemSchema.safeParse({
        body: { ...baseItem, name: "x".repeat(81) },
      }).success
    ).toBe(false);
  });
});

describe("updateMenuItemSchema", () => {
  it("rejects a PATCH that names no field", () => {
    const result = updateMenuItemSchema.safeParse({
      params: { id: "item_1" },
      body: {},
    });

    expect(result.success).toBe(false);
    expect(messageOf(result)).toBe("Provide at least one field to update");
  });

  it("accepts a single changed field", () => {
    const parsed = updateMenuItemSchema.parse({
      params: { id: "item_1" },
      body: { isAvailable: false },
    });

    expect(parsed.body).toEqual({ isAvailable: false });
  });

  it("allows clearing sizes with an empty array", () => {
    const parsed = updateMenuItemSchema.parse({
      params: { id: "item_1" },
      body: { sizes: [] },
    });

    expect(parsed.body.sizes).toEqual([]);
  });
});

describe("listMenuItemsSchema", () => {
  it("treats an empty categoryId as no filter", () => {
    expect(listMenuItemsSchema.parse({ query: { categoryId: "" } }).query).toEqual({
      categoryId: undefined,
    });
  });

  it("keeps a real category id", () => {
    expect(
      listMenuItemsSchema.parse({ query: { categoryId: " category_1 " } }).query
        .categoryId
    ).toBe("category_1");
  });
});
