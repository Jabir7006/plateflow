import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createStaffUser,
  db,
  login,
  provisionRestaurant,
  removeFixtures,
  removeIssuedRefreshTokens,
  startServer,
  type Provisioned,
  type Session,
  type TestServer,
} from "../harness.js";

// The order path end to end: money is computed server-side from the menu, the
// lifecycle only moves forward, and reporting is scoped to the tenant.

interface ItemView {
  id: string;
  name: string;
  price: number;
  sizes: { id: string; label: string; price: number }[];
}

let server: TestServer;
let request: ReturnType<typeof api>;

let restaurantA: Provisioned;
let ownerA: Session;
let tableA: { id: string; qrCode: string };
let soup: ItemView;
let pizza: ItemView;
let soldOut: ItemView;

let restaurantB: Provisioned;
let ownerB: Session;
let waiterB: Session;
let managerB: Session;
let tableB: { id: string; qrCode: string };
let itemB: ItemView;

const json = (method: string, body: unknown, headers: Record<string, string>) => ({
  method,
  headers,
  body: JSON.stringify(body),
});

async function createCategory(session: Session, name: string) {
  const { body } = await request("/api/v1/menu/categories", {
    ...json("POST", { name }, session.headers),
    expect: 201,
  });
  return body.data as { id: string };
}

async function createItem(session: Session, input: Record<string, unknown>) {
  const { body } = await request("/api/v1/menu/items", {
    ...json("POST", input, session.headers),
    expect: 201,
  });
  return body.data as ItemView;
}

async function createTable(session: Session, number: number) {
  const { body } = await request("/api/v1/tables", {
    ...json("POST", { number }, session.headers),
    expect: 201,
  });
  return body.data as { id: string; qrCode: string };
}

async function place(
  token: string,
  items: unknown[],
  options: { note?: unknown; expect?: number; extra?: Record<string, unknown> } = {}
) {
  const { note, expect = 201, extra = {} } = options;
  const { body } = await request(`/api/v1/t/${token}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      ...(note === undefined ? {} : { note }),
      ...extra,
    }),
    expect,
  });
  return body;
}

const placeB = async (items: unknown[]) => {
  const body = await place(tableB.qrCode, items);
  return body.data.id as string;
};

async function readStatus(token: string, orderId: string, expect = 200) {
  const { body } = await request(`/api/v1/t/${token}/orders/${orderId}`, { expect });
  return body.data;
}

async function advance(
  orderId: string,
  status: string,
  session = ownerA,
  expect = 200
) {
  const { body } = await request(`/api/v1/orders/${orderId}/status`, {
    ...json("PATCH", { status }, session.headers),
    expect,
  });
  return body;
}

// The lifecycle has no shortcuts, so reaching SERVED means walking the chain.
async function serve(orderId: string, session = ownerA) {
  await advance(orderId, "PREPARING", session);
  await advance(orderId, "READY", session);
  return advance(orderId, "SERVED", session);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);

  restaurantA = await provisionRestaurant("Order Lifecycle A");
  ownerA = await login(request, restaurantA.email, restaurantA.password);
  tableA = await createTable(ownerA, 5);
  const categoryA = await createCategory(ownerA, "Dishes");
  soup = await createItem(ownerA, {
    name: "Soup",
    price: 10,
    categoryId: categoryA.id,
  });
  pizza = await createItem(ownerA, {
    name: "Pizza",
    price: 12,
    categoryId: categoryA.id,
    sizes: [
      { label: "Small", price: 8 },
      { label: "Large", price: 15 },
    ],
  });
  soldOut = await createItem(ownerA, {
    name: "Sold Out Soup",
    price: 5,
    categoryId: categoryA.id,
    isAvailable: false,
  });

  restaurantB = await provisionRestaurant("Order Lifecycle B");
  ownerB = await login(request, restaurantB.email, restaurantB.password);
  waiterB = await login(
    request,
    ...(await staffLogin("WAITER", restaurantB))
  );
  managerB = await login(
    request,
    ...(await staffLogin("MANAGER", restaurantB))
  );
  tableB = await createTable(ownerB, 1);
  const categoryB = await createCategory(ownerB, "Reporting");
  itemB = await createItem(ownerB, {
    name: "Report Dish",
    price: 12.5,
    categoryId: categoryB.id,
  });

  async function staffLogin(role: "WAITER" | "MANAGER", restaurant: Provisioned) {
    const staff = await createStaffUser({
      restaurantId: restaurant.restaurantId,
      role,
    });
    return [staff.email, staff.password] as const;
  }
});

afterAll(async () => {
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("placing an order", () => {
  it("computes the total from the menu and snapshots each line", async () => {
    const large = pizza.sizes.find((size) => size.label === "Large")!;

    const body = await place(
      tableA.qrCode,
      [
        // A tampered client price is stripped by validation and ignored.
        { menuItemId: soup.id, quantity: 2, price: 0.01 },
        { menuItemId: pizza.id, sizeId: large.id, quantity: 1 },
      ],
      { note: "  extra napkins ", extra: { total: 0.01 } }
    );

    const view = await readStatus(tableA.qrCode, body.data.id);

    expect(view).toMatchObject({
      status: "PENDING",
      tableNumber: 5,
      total: 35, // 2 * 10 + 1 * 15
      note: "extra napkins",
    });
    expect(view.lines).toEqual([
      { name: "Soup", sizeLabel: null, quantity: 2, unitPrice: 10 },
      { name: "Pizza", sizeLabel: "Large", quantity: 1, unitPrice: 15 },
    ]);
  });

  it("stores an empty note as null", async () => {
    const body = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }], {
      note: "   ",
    });
    const view = await readStatus(tableA.qrCode, body.data.id);

    expect(view.note).toBeNull();
  });

  it("requires a size for a sized item", async () => {
    const { message } = await place(
      tableA.qrCode,
      [{ menuItemId: pizza.id, quantity: 1 }],
      { expect: 400 }
    );

    expect(message).toBe("Please choose a size for Pizza.");
  });

  it("rejects a size that no longer exists as a stale menu", async () => {
    const { message } = await place(
      tableA.qrCode,
      [{ menuItemId: pizza.id, sizeId: "size_that_never_existed", quantity: 1 }],
      { expect: 409 }
    );

    expect(message).toMatch(/menu is out of date/i);
  });

  it("rejects an unavailable dish by name", async () => {
    const { message } = await place(
      tableA.qrCode,
      [{ menuItemId: soldOut.id, quantity: 1 }],
      { expect: 409 }
    );

    expect(message).toMatch(/Sold Out Soup is no longer available/i);
  });

  it("rejects an item that is not on this restaurant's menu", async () => {
    const { message } = await place(
      tableA.qrCode,
      [{ menuItemId: itemB.id, quantity: 1 }],
      { expect: 409 }
    );

    expect(message).toMatch(/menu is out of date/i);
  });

  it("404s an unknown table code", async () => {
    await place(
      "not-a-real-table-token",
      [{ menuItemId: soup.id, quantity: 1 }],
      { expect: 404 }
    );
  });

  it("rejects an empty order", async () => {
    const { message } = await place(tableA.qrCode, [], { expect: 400 });

    expect(message).toBe("Validation failed");
  });

  it.each([
    ["zero", 0],
    ["over the ceiling", 100],
    ["fractional", 1.5],
  ])("rejects a %s quantity before writing anything", async (_label, quantity) => {
    await place(tableA.qrCode, [{ menuItemId: soup.id, quantity }], {
      expect: 400,
    });
  });

  it("caps a single order at 50 lines", async () => {
    await place(
      tableA.qrCode,
      Array.from({ length: 51 }, () => ({ menuItemId: soup.id, quantity: 1 })),
      { expect: 400 }
    );
  });

  it("does not read an order through the wrong table token", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);

    await request(`/api/v1/t/${tableB.qrCode}/orders/${order.data.id}`, {
      expect: 404,
    });
  });
});

describe("status transitions", () => {
  it("advances forward and treats a repeat as idempotent", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);
    const id = order.data.id;

    expect((await advance(id, "PREPARING")).data.status).toBe("PREPARING");
    expect((await advance(id, "PREPARING")).data.status).toBe("PREPARING");
    expect((await advance(id, "READY")).data.status).toBe("READY");
    expect((await advance(id, "SERVED")).data.status).toBe("SERVED");

    expect((await readStatus(tableA.qrCode, id)).status).toBe("SERVED");
  });

  it("refuses to skip a step", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);

    const { message } = await advance(order.data.id, "READY", ownerA, 409);

    expect(message).toBe("Can't move an order from pending to ready.");
  });

  it("refuses to move out of a terminal status", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);
    await advance(order.data.id, "CANCELLED");

    const { message } = await advance(order.data.id, "PREPARING", ownerA, 409);

    expect(message).toBe("This order is already cancelled.");
  });

  it("cancels from an active status and then stops", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);
    await advance(order.data.id, "PREPARING");

    expect((await advance(order.data.id, "CANCELLED")).data.status).toBe("CANCELLED");
  });

  it("treats PENDING as an idempotent start state, not a target", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);

    expect((await advance(order.data.id, "PENDING")).data.status).toBe("PENDING");
  });

  it("404s an order that does not exist", async () => {
    const { message } = await advance("order_does_not_exist", "PREPARING", ownerA, 404);

    expect(message).toBe("We couldn't find this order.");
  });

  it("rejects an invented status value", async () => {
    const order = await place(tableA.qrCode, [{ menuItemId: soup.id, quantity: 1 }]);

    await advance(order.data.id, "DONE", ownerA, 400);
  });
});

describe("the kitchen board", () => {
  it("shows active orders oldest-first and drops finished ones", async () => {
    const first = await placeB([{ menuItemId: itemB.id, quantity: 1 }]);
    await sleep(10);
    const second = await placeB([{ menuItemId: itemB.id, quantity: 1 }]);

    await advance(second, "PREPARING", ownerB);

    let board = await request("/api/v1/orders", { headers: ownerB.headers });
    let ids = board.body.data.map((order: { id: string }) => order.id);
    expect(ids.indexOf(first)).toBeLessThan(ids.indexOf(second));

    await serve(first, ownerB);

    board = await request("/api/v1/orders", { headers: ownerB.headers });
    ids = board.body.data.map((order: { id: string }) => order.id);
    expect(ids).not.toContain(first);
    expect(ids).toContain(second);
  });

  it("requires a staff session", async () => {
    await request("/api/v1/orders", { expect: 401 });
  });

  it("lets a waiter work the board and advance orders", async () => {
    const order = await placeB([{ menuItemId: itemB.id, quantity: 1 }]);

    const board = await request("/api/v1/orders", { headers: waiterB.headers });
    expect(board.body.data.map((entry: { id: string }) => entry.id)).toContain(order);

    const advanced = await advance(order, "PREPARING", waiterB);
    expect(advanced.data.status).toBe("PREPARING");
  });
});

describe("order history", () => {
  it("pages through orders without dropping or repeating one", async () => {
    const created: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      created.push(await placeB([{ menuItemId: itemB.id, quantity: 1 }]));
      await sleep(10);
    }

    const firstPage = await request("/api/v1/orders/history?page=1&pageSize=2", {
      headers: ownerB.headers,
    });
    expect(firstPage.body.data.orders).toHaveLength(2);
    expect(firstPage.body.data.page).toBe(1);
    expect(firstPage.body.data.totalPages).toBeGreaterThanOrEqual(2);

    const seen = new Set<string>();
    for (let page = 1; page <= firstPage.body.data.totalPages; page += 1) {
      const { body } = await request(
        `/api/v1/orders/history?page=${page}&pageSize=2`,
        { headers: ownerB.headers }
      );
      for (const order of body.data.orders) {
        expect(seen.has(order.id)).toBe(false);
        seen.add(order.id);
      }
    }
    for (const id of created) expect(seen.has(id)).toBe(true);
  });

  it("clamps a page past the end to the last real page", async () => {
    const { body } = await request("/api/v1/orders/history?page=999&pageSize=2", {
      headers: ownerB.headers,
    });

    expect(body.data.page).toBe(body.data.totalPages);
    expect(body.data.orders.length).toBeGreaterThan(0);
  });

  it("filters by status and by date range", async () => {
    const served = await placeB([{ menuItemId: itemB.id, quantity: 1 }]);
    await serve(served, ownerB);
    await sleep(10);

    const filtered = await request("/api/v1/orders/history?status=SERVED", {
      headers: ownerB.headers,
    });
    expect(filtered.body.data.orders.length).toBeGreaterThan(0);
    expect(
      filtered.body.data.orders.every(
        (order: { status: string }) => order.status === "SERVED"
      )
    ).toBe(true);
    expect(
      filtered.body.data.orders.map((order: { id: string }) => order.id)
    ).toContain(served);

    const beforeTheRestaurantExisted = await request(
      "/api/v1/orders/history?to=2020-01-01T00:00:00Z",
      { headers: ownerB.headers }
    );
    expect(beforeTheRestaurantExisted.body.data.total).toBe(0);
    expect(beforeTheRestaurantExisted.body.data.orders).toEqual([]);
  });

  it("rejects invalid paging and a reversed range", async () => {
    await request("/api/v1/orders/history?page=0", {
      headers: ownerB.headers,
      expect: 400,
    });
    await request("/api/v1/orders/history?pageSize=101", {
      headers: ownerB.headers,
      expect: 400,
    });
    await request(
      "/api/v1/orders/history?from=2026-09-26T00:00:00Z&to=2026-09-25T00:00:00Z",
      { headers: ownerB.headers, expect: 400 }
    );
  });
});

describe("sales stats", () => {
  it("counts every status and only books delivered money as revenue", async () => {
    const baseline = await request("/api/v1/orders/stats", {
      headers: ownerB.headers,
    });

    const served = await placeB([{ menuItemId: itemB.id, quantity: 2 }]);
    const cancelled = await placeB([{ menuItemId: itemB.id, quantity: 1 }]);
    await placeB([{ menuItemId: itemB.id, quantity: 1 }]);
    await serve(served, ownerB);
    await advance(cancelled, "CANCELLED", ownerB);

    const { body } = await request("/api/v1/orders/stats", {
      headers: ownerB.headers,
    });
    const before = baseline.body.data;
    const after = body.data;

    expect(after.totalOrders).toBe(before.totalOrders + 3);
    expect(after.revenue).toBeCloseTo(before.revenue + 25, 2); // 2 * 12.50

    const delta = (status: string) =>
      after.byStatus.find((row: { status: string }) => row.status === status).count -
      before.byStatus.find((row: { status: string }) => row.status === status).count;

    expect(delta("PENDING")).toBe(1);
    expect(delta("SERVED")).toBe(1);
    expect(delta("CANCELLED")).toBe(1);
    expect(after.byStatus).toHaveLength(5);
  });

  it("returns an empty report for a range with no orders", async () => {
    const { body } = await request("/api/v1/orders/stats?to=2020-01-01T00:00:00Z", {
      headers: ownerB.headers,
    });

    expect(body.data).toMatchObject({
      from: null,
      to: "2020-01-01T00:00:00Z",
      totalOrders: 0,
      revenue: 0,
    });
    expect(body.data.byStatus).toHaveLength(5);
    expect(
      body.data.byStatus.every(
        (row: { count: number; revenue: number }) => row.count === 0 && row.revenue === 0
      )
    ).toBe(true);
  });

  it("keeps financial reporting away from waiters", async () => {
    await request("/api/v1/orders/stats", {
      headers: waiterB.headers,
      expect: 403,
    });
    await request("/api/v1/orders/stats", { headers: managerB.headers });
    await request("/api/v1/orders/stats", { headers: ownerB.headers });
  });
});
