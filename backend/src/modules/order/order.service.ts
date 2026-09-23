import type {
  OrderStatusView,
  PlaceOrderSchema,
  PlacedOrder,
} from "@plateflow/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";

type PlaceOrderInput = PlaceOrderSchema["body"];

// An unknown token (garbage, or a rotated code) 404s — the same friendly line
// the menu uses, since the diner reached both the same way.
const unknownTokenError = () =>
  new AppError(
    "This code isn't valid. Ask a member of staff for help.",
    HTTP_STATUS.NOT_FOUND
  );

// The client builds the order from the same menu it just showed, so these are
// defensive: they only fire if the menu changed under the diner (an item pulled,
// re-sized, or made unavailable) between load and submit. Each names the dish so
// the diner knows what to fix.
const unavailableError = (name: string) =>
  new AppError(
    `${name} is no longer available. Please remove it and try again.`,
    HTTP_STATUS.CONFLICT
  );

const staleMenuError = () =>
  new AppError(
    "Your menu is out of date. Please refresh and try again.",
    HTTP_STATUS.CONFLICT
  );

const sizeRequiredError = (name: string) =>
  new AppError(`Please choose a size for ${name}.`, HTTP_STATUS.BAD_REQUEST);

const orderItemInclude = {
  items: true,
  table: { select: { number: true } },
} as const satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderItemInclude }>;

const toStatusView = (order: OrderRow): OrderStatusView => ({
  id: order.id,
  status: order.status,
  tableNumber: order.table.number,
  // Decimal -> number is lossless here: the columns hold 2 decimals and the
  // value round-trips through JSON. Money is summed as Decimal (below), never
  // as a float.
  total: order.total.toNumber(),
  note: order.note,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  lines: order.items.map((item) => ({
    name: item.nameSnapshot,
    sizeLabel: item.sizeLabel,
    quantity: item.quantity,
    unitPrice: item.price.toNumber(),
  })),
});

class OrderService {
  async placeOrder(token: string, input: PlaceOrderInput): Promise<PlacedOrder> {
    const table = await prisma.table.findUnique({
      where: { qrCode: token },
      select: { id: true },
    });

    if (!table) {
      throw unknownTokenError();
    }

    // One query for every referenced item + its sizes, rather than one per line.
    const ids = [...new Set(input.items.map((line) => line.menuItemId))];
    const items = await prisma.menuItem.findMany({
      where: { id: { in: ids } },
      include: { sizes: true },
    });
    const itemsById = new Map(items.map((item) => [item.id, item]));

    // Price and snapshot every line from the database — the client sent only
    // ids and quantities, so a tampered or stale price is impossible to submit.
    let total = new Prisma.Decimal(0);
    const lines = input.items.map((line) => {
      const item = itemsById.get(line.menuItemId);
      if (!item) {
        throw staleMenuError();
      }
      if (!item.isAvailable) {
        throw unavailableError(item.name);
      }

      let sizeLabel: string | null = null;
      let unitPrice = item.price;

      if (item.sizes.length > 0) {
        if (!line.sizeId) {
          throw sizeRequiredError(item.name);
        }
        const size = item.sizes.find((s) => s.id === line.sizeId);
        if (!size) {
          throw staleMenuError();
        }
        sizeLabel = size.label;
        unitPrice = size.price;
      } else if (line.sizeId) {
        // A size for an item that has none: the menu the client used is stale.
        throw staleMenuError();
      }

      total = total.add(unitPrice.mul(line.quantity));

      return {
        menuItemId: item.id,
        nameSnapshot: item.name,
        sizeLabel,
        quantity: line.quantity,
        price: unitPrice,
      };
    });

    // Order + its lines in one nested create, which Prisma runs in a single
    // transaction: a failure writes nothing.
    const order = await prisma.order.create({
      data: {
        tableId: table.id,
        total,
        note: input.note ?? null,
        items: { create: lines },
      },
      select: { id: true },
    });

    return { id: order.id };
  }

  // Scoped by the table token as well as the id: a real order id under the wrong
  // table returns nothing and 404s, so a token only ever sees its own orders.
  async getOrderStatus(token: string, orderId: string): Promise<OrderStatusView> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, table: { qrCode: token } },
      include: orderItemInclude,
    });

    if (!order) {
      throw new AppError("We couldn't find this order.", HTTP_STATUS.NOT_FOUND);
    }

    return toStatusView(order);
  }
}

export default new OrderService();
