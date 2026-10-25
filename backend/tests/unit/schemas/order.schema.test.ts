import { describe, expect, it } from "vitest";
import {
  orderHistoryQuerySchema,
  orderStatsQuerySchema,
  placeOrderSchema,
  updateOrderStatusSchema,
} from "@plateflow/shared";

const messageOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

const line = (overrides: Record<string, unknown> = {}) => ({
  menuItemId: "item_1",
  quantity: 1,
  ...overrides,
});

const order = (items: unknown[], note?: unknown) => ({
  params: { token: "table-token" },
  body: { items, ...(note === undefined ? {} : { note }) },
});

describe("placeOrderSchema", () => {
  it("accepts ids and quantities, stripping anything the client invents", () => {
    const parsed = placeOrderSchema.parse(
      order([{ ...line(), price: 0.01, name: "Free soup" }])
    );

    expect(parsed.body.items).toEqual([{ menuItemId: "item_1", quantity: 1 }]);
  });

  it("allows a nullish size id for unsized items", () => {
    expect(
      placeOrderSchema.safeParse(order([line({ sizeId: null })])).success
    ).toBe(true);
  });

  it("requires at least one line", () => {
    const result = placeOrderSchema.safeParse(order([]));

    expect(messageOf(result)).toBe("Add something to your order first");
  });

  it("caps an order at 50 lines", () => {
    const result = placeOrderSchema.safeParse(
      order(Array.from({ length: 51 }, () => line()))
    );

    expect(result.success).toBe(false);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["over 99", 100],
    ["string", "2"],
  ])("rejects a %s quantity", (_label, quantity) => {
    expect(
      placeOrderSchema.safeParse(order([line({ quantity })])).success
    ).toBe(false);
  });

  it("accepts the quantity bounds", () => {
    expect(placeOrderSchema.safeParse(order([line({ quantity: 1 })])).success).toBe(
      true
    );
    expect(placeOrderSchema.safeParse(order([line({ quantity: 99 })])).success).toBe(
      true
    );
  });

  it("trims the note and turns an empty note into null", () => {
    expect(placeOrderSchema.parse(order([line()], "  window seat ")).body.note).toBe(
      "window seat"
    );
    expect(placeOrderSchema.parse(order([line()], "   ")).body.note).toBeNull();
  });

  it("bounds the note length", () => {
    expect(
      placeOrderSchema.safeParse(order([line()], "x".repeat(201))).success
    ).toBe(false);
  });

  it("requires a sane table token", () => {
    expect(
      placeOrderSchema.safeParse({
        params: { token: "   " },
        body: { items: [line()] },
      }).success
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({
        params: { token: "x".repeat(129) },
        body: { items: [line()] },
      }).success
    ).toBe(false);
  });
});

describe("updateOrderStatusSchema", () => {
  it("accepts every real status", () => {
    for (const status of [
      "PENDING",
      "PREPARING",
      "READY",
      "SERVED",
      "CANCELLED",
    ] as const) {
      expect(
        updateOrderStatusSchema.safeParse({
          params: { orderId: "order_1" },
          body: { status },
        }).success
      ).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { orderId: "order_1" },
      body: { status: "DONE" },
    });

    expect(result.success).toBe(false);
  });
});

describe("orderHistoryQuerySchema", () => {
  it("defaults to the first page at size 20", () => {
    expect(orderHistoryQuerySchema.parse({ query: {} }).query).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("coerces numeric query strings", () => {
    expect(
      orderHistoryQuerySchema.parse({ query: { page: "3", pageSize: "50" } }).query
    ).toMatchObject({ page: 3, pageSize: 50 });
  });

  it("treats empty filters as absent", () => {
    expect(
      orderHistoryQuerySchema.parse({
        query: { page: "", pageSize: "", status: "", from: "", to: "" },
      }).query
    ).toEqual({ page: 1, pageSize: 20 });
  });

  it.each([
    ["page zero", { page: "0" }],
    ["fractional page", { page: "1.5" }],
    ["non-numeric page", { page: "abc" }],
    ["page size zero", { pageSize: "0" }],
    ["page size over 100", { pageSize: "101" }],
  ])("rejects %s", (_label, query) => {
    expect(orderHistoryQuerySchema.safeParse({ query }).success).toBe(false);
  });

  it("accepts a real status filter and rejects an invented one", () => {
    expect(
      orderHistoryQuerySchema.parse({ query: { status: "SERVED" } }).query.status
    ).toBe("SERVED");
    expect(
      orderHistoryQuerySchema.safeParse({ query: { status: "DONE" } }).success
    ).toBe(false);
  });

  it("requires full ISO instants for date bounds", () => {
    expect(
      orderHistoryQuerySchema.safeParse({
        query: { from: "2026-09-25T18:30:00Z" },
      }).success
    ).toBe(true);
    expect(
      orderHistoryQuerySchema.safeParse({
        query: { from: "2026-09-25T18:30:00+06:00" },
      }).success
    ).toBe(true);
    expect(
      orderHistoryQuerySchema.safeParse({ query: { from: "2026-09-25" } }).success
    ).toBe(false);
  });

  it("rejects a reversed range and accepts an equal one", () => {
    const reversed = orderHistoryQuerySchema.safeParse({
      query: {
        from: "2026-09-26T00:00:00Z",
        to: "2026-09-25T00:00:00Z",
      },
    });
    expect(messageOf(reversed)).toBe(
      "The start of the range must be on or before the end"
    );

    expect(
      orderHistoryQuerySchema.safeParse({
        query: {
          from: "2026-09-25T00:00:00Z",
          to: "2026-09-25T00:00:00Z",
        },
      }).success
    ).toBe(true);
  });
});

describe("orderStatsQuerySchema", () => {
  it("accepts an open-ended or bounded range", () => {
    expect(orderStatsQuerySchema.parse({ query: {} }).query).toEqual({
      from: undefined,
      to: undefined,
    });
    expect(
      orderStatsQuerySchema.safeParse({ query: { from: "2026-09-25T00:00:00Z" } })
        .success
    ).toBe(true);
  });

  it("rejects a reversed range", () => {
    expect(
      orderStatsQuerySchema.safeParse({
        query: {
          from: "2026-09-26T00:00:00Z",
          to: "2026-09-25T00:00:00Z",
        },
      }).success
    ).toBe(false);
  });
});
