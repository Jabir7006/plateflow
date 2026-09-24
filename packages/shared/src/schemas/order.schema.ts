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
