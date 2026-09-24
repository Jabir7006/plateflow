// The lifecycle a diner's order moves through. Mirrors the Prisma `OrderStatus`
// enum; kept as a string union here so the shared package stays free of any
// Prisma import. PENDING is where a freshly placed order starts; SERVED and
// CANCELLED are terminal (the status page stops polling there).
export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

// One line of a placed order, read back for the status page. These are the
// snapshots taken at order time, not live joins onto the menu, so they render
// what the diner actually ordered even after the menu changes.
export interface OrderLine {
  name: string;
  sizeLabel: string | null;
  quantity: number;
  // The per-unit price paid.
  unitPrice: number;
}

// The response to placing an order: just the id the phone stores (in
// localStorage, keyed by table token) and puts in the status-page URL. The id
// is the capability — whoever holds it can watch that order.
export interface PlacedOrder {
  id: string;
}

// Everything the status page renders. `total` is the server-computed sum; the
// client never adds prices for anything but display.
export interface OrderStatusView {
  id: string;
  status: OrderStatus;
  tableNumber: number;
  total: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
}

// What the staff order board shows for one order. It needs exactly what the
// diner status view carries — the same lines, note, total, table and
// timestamps — so it's the same shape. Kept as a distinct name so the two can
// diverge later (e.g. staff-only fields) without touching the diner side.
export type StaffOrderView = OrderStatusView;

// The realtime contract, shared so the socket server and the browser client
// agree on names and payloads. `new` fires when a diner places an order (to
// staff); `updated` fires when its status changes (to staff and to that order's
// diner). Both carry the full view so a receiver can render without a refetch.
export const ORDER_EVENTS = {
  new: "order:new",
  updated: "order:updated",
} as const;

export interface OrderEventPayload {
  order: OrderStatusView;
}

// The handshake rejection reason the socket server sends and the client checks.
// It lets the client tell a genuine auth failure (stop reconnecting) from a
// transient drop (keep reconnecting), so it belongs to the realtime contract.
export const SOCKET_AUTH_ERROR = "unauthorized";

// The response of GET /realtime/ticket: a short-lived token the staff client
// hands to socket.io in its connection `auth`, since the httpOnly session
// cookie can't travel on the cross-origin socket handshake.
export interface RealtimeTicket {
  ticket: string;
}

// The socket.io handshake `auth` payloads. Staff prove themselves with a
// ticket; a diner uses the same table token + order id capability as the REST
// read, and the server verifies the order belongs to that token before joining.
export interface StaffSocketAuth {
  ticket: string;
}

export interface DinerSocketAuth {
  token: string;
  orderId: string;
}
