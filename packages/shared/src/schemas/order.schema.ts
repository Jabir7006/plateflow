import { z } from "zod";

const requiredId = (label: string) =>
  z.string(`${label} id is required`).trim().min(1, `${label} id is required`);

// The QR token that scopes an order to its table — same shape the diner menu
// route validates. The real check is the DB lookup, which 404s an unknown token.
const token = z
  .string("A table code is required")
  .trim()
  .min(1, "A table code is required")
  .max(128, "That doesn't look like a valid table code");

// A diner can't order 0 of something, and no one taps "add" 100 times — a sane
// ceiling that catches a runaway client without getting in a real order's way.
const quantity = z
  .number("Quantity is required")
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(99, "That's more than we can take in one line");

// One cart line. The client sends only ids + how many; the server looks up the
// name and price so a tampered or stale price can never be trusted.
const orderLine = z.object({
  menuItemId: requiredId("Menu item"),
  // Present only for a sized item, and it must belong to that item — enforced
  // server-side against the menu, not here.
  sizeId: requiredId("Size").nullish(),
  quantity,
});

// A single order can't be empty, and a real table order is a handful of lines,
// not hundreds.
const MAX_ORDER_LINES = 50;

const note = z
  .string("Note must be text")
  .trim()
  .max(200, "Note must be 200 characters or fewer")
  .transform((value) => (value === "" ? null : value))
  .nullish();

export const placeOrderSchema = z.object({
  params: z.object({ token }),
  body: z.object({
    items: z
      .array(orderLine)
      .min(1, "Add something to your order first")
      .max(MAX_ORDER_LINES, "That's too many items for one order"),
    note,
  }),
});

export const orderStatusParamsSchema = z.object({
  params: z.object({
    token,
    orderId: requiredId("Order"),
  }),
});

// Every status a line can hold, mirroring the Prisma enum. The status page and
// the staff board both read the union type in order.types.ts; this is the same
// set expressed for validation. Which transitions are *legal* (forward-only,
// plus cancel) is enforced server-side, not here — the schema only guards that
// the value is a real status.
export const orderStatusValues = [
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
] as const;

// Staff advancing an order: the order id in the path, the target status in the
// body. Used by the authenticated PATCH /orders/:orderId/status route.
export const updateOrderStatusSchema = z.object({
  params: z.object({ orderId: requiredId("Order") }),
  body: z.object({
    status: z.enum(orderStatusValues, "That isn't a valid order status"),
  }),
});

export type PlaceOrderSchema = z.infer<typeof placeOrderSchema>;
export type OrderStatusParamsSchema = z.infer<typeof orderStatusParamsSchema>;
export type UpdateOrderStatusSchema = z.infer<typeof updateOrderStatusSchema>;

// --- Staff reporting: order history + sales summary ---
// Query params arrive as strings; missing or empty falls back to the first page
// at a sane size, and both are clamped so a client can't ask for the whole table.
const historyPage = z.preprocess(
  (value) => (value === undefined || value === "" ? 1 : value),
  z.coerce.number().int("Page must be a whole number").min(1, "Page must be at least 1")
);

const historyPageSize = z.preprocess(
  (value) => (value === undefined || value === "" ? 20 : value),
  z.coerce
    .number()
    .int("Page size must be a whole number")
    .min(1, "Page size must be at least 1")
    .max(100, "Page size can't exceed 100")
);

// A date-range bound on createdAt, as a full ISO-8601 date-time (offset or Z).
// The API deals in instants, not calendar dates: the caller (the staff UI, which
// knows the restaurant's timezone) computes the local day boundaries and sends
// them as instants. That keeps the server timezone-agnostic and avoids collapsing
// a plain date to UTC midnight, which would silently drop the range's end day.
const dateBound = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.iso
    .datetime({
      offset: true,
      error: "Enter an ISO-8601 date-time, e.g. 2026-09-25T18:30:00Z",
    })
    .optional()
);

// The status filter. A cleared "All" filter sends `status=` — normalise that
// empty string to absent (no filter), matching how the page/size/date bounds
// treat "", rather than 400ing it as an invalid status.
const statusFilter = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(orderStatusValues, "That isn't a valid order status").optional()
);

// A reversed range (from after to) matches nothing, which reads as a genuinely
// quiet period rather than the mistake it is — reject it instead. Only compares
// when both bounds parse: if one failed the date-time format check, that error
// already stands, so we don't pile on a bogus ordering error against an
// Invalid Date.
const orderedRange = (range: { from?: string; to?: string }) => {
  if (!range.from || !range.to) return true;
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return true;
  return from <= to;
};
const rangeError = {
  message: "The start of the range must be on or before the end",
  path: ["to"],
};

// GET /api/v1/orders/history — the paged, filterable record behind the board.
export const orderHistoryQuerySchema = z.object({
  query: z
    .object({
      page: historyPage,
      pageSize: historyPageSize,
      status: statusFilter,
      from: dateBound,
      to: dateBound,
    })
    .refine(orderedRange, rangeError),
});

// GET /api/v1/orders/stats — sales summary over an optional date range.
export const orderStatsQuerySchema = z.object({
  query: z
    .object({
      from: dateBound,
      to: dateBound,
    })
    .refine(orderedRange, rangeError),
});

export type OrderHistoryQuerySchema = z.infer<typeof orderHistoryQuerySchema>;
export type OrderStatsQuerySchema = z.infer<typeof orderStatsQuerySchema>;
