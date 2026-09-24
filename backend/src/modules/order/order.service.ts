import type {
  OrderStatusView,
  PlaceOrderSchema,
  PlacedOrder,
  StaffOrderView,
} from "@plateflow/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { OrderStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import { emitOrderNew, emitOrderUpdated } from "../../realtime/realtime.js";

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

const orderNotFoundError = () =>
  new AppError("We couldn't find this order.", HTTP_STATUS.NOT_FOUND);

const isTerminalStatus = (status: OrderStatus) =>
  status === OrderStatus.SERVED || status === OrderStatus.CANCELLED;

// A rejected status change: either the order is already finished, or the move
// isn't a legal step. Names the current status so staff see why (409, mirroring
// the place-order conflicts above).
const transitionError = (current: OrderStatus, target: OrderStatus) =>
  new AppError(
    isTerminalStatus(current)
      ? `This order is already ${current.toLowerCase()}.`
      : `Can't move an order from ${current.toLowerCase()} to ${target.toLowerCase()}.`,
    HTTP_STATUS.CONFLICT
  );

// Which statuses an order may legally move *from* to reach each target. Encodes
// forward-only progress plus cancel-from-any-active; PENDING is the start state,
// so it is never a target. Terminal statuses (SERVED, CANCELLED) appear in no
// list, so nothing can move out of them.
const STATUS_PREDECESSORS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PREPARING]: [OrderStatus.PENDING],
  [OrderStatus.READY]: [OrderStatus.PREPARING],
  [OrderStatus.SERVED]: [OrderStatus.READY],
  [OrderStatus.CANCELLED]: [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.READY,
  ],
};

const loadStaffView = async (orderId: string): Promise<StaffOrderView> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderItemInclude,
  });
  if (!order) {
    throw orderNotFoundError();
  }
  return toStatusView(order);
};

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
      include: orderItemInclude,
    });

    // Push it to the staff board so a new order lands there instantly. The diner
    // only needs the id back — the capability to watch this order.
    emitOrderNew(toStatusView(order));

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

  // The live kitchen board: every order still in play (not served or cancelled),
  // oldest first so staff work the queue front-to-back.
  async listActiveOrders(): Promise<StaffOrderView[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: [OrderStatus.SERVED, OrderStatus.CANCELLED] },
      },
      include: orderItemInclude,
      orderBy: { createdAt: "asc" },
    });

    return orders.map(toStatusView);
  }

  // Staff advancing an order (PENDING → PREPARING → READY → SERVED) or cancelling
  // it. The transition is guarded so it can only step forward or cancel, and the
  // guard rides the write itself (updateMany filtered on the allowed previous
  // statuses) so two staff acting on the same order at once can't both apply.
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<StaffOrderView> {
    const predecessors = STATUS_PREDECESSORS[status];

    // No predecessors means `status` is PENDING — the start state, never a
    // target. Report it against the order's real state (idempotent if it somehow
    // already sits there, otherwise a plain conflict).
    if (!predecessors) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!current) throw orderNotFoundError();
      if (current.status === status) return loadStaffView(orderId);
      throw transitionError(current.status, status);
    }

    const result = await prisma.order.updateMany({
      where: { id: orderId, status: { in: predecessors } },
      data: { status },
    });

    // Nothing moved: the order is gone, already in this status (a double-tap —
    // treat as success), or in a state this step isn't legal from. One read tells
    // the three apart.
    if (result.count === 0) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!current) throw orderNotFoundError();
      if (current.status === status) return loadStaffView(orderId);
      throw transitionError(current.status, status);
    }

    const view = await loadStaffView(orderId);
    emitOrderUpdated(view);
    return view;
  }
}

export default new OrderService();
