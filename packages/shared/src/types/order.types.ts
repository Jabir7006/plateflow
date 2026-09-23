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
