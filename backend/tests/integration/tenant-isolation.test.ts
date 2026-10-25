import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  api,
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

// The security guarantee for the multi-tenant branch: with two real restaurants
// in one database, neither can see, change, or be notified about the other's
// data. Every case here is a leak or a cross-tenant write if it regresses.

let server: TestServer;
let request: ReturnType<typeof api>;
let a: Provisioned;
let b: Provisioned;
let sessionA: Session;
let sessionB: Session;

let tableA: { id: string; qrCode: string; number: number };
let tableB: { id: string; qrCode: string; number: number };
let categoryA: { id: string };
let categoryB: { id: string };
let itemA: { id: string };
let itemB: { id: string };
let orderA: { id: string };
let orderB: { id: string };

const sockets: Socket[] = [];

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);

  a = await provisionRestaurant("Isolation A");
  b = await provisionRestaurant("Isolation B");

  sessionA = await login(request, a.email, a.password);
  sessionB = await login(request, b.email, b.password);

  const createTable = async (session: Session) =>
    (
      await request("/api/v1/tables", {
        method: "POST",
        headers: session.headers,
        body: JSON.stringify({ number: 1 }),
        expect: 201,
      })
    ).body.data;
  tableA = await createTable(sessionA);
  tableB = await createTable(sessionB);

  const createCategory = async (session: Session, name: string) =>
    (
      await request("/api/v1/menu/categories", {
        method: "POST",
        headers: session.headers,
        body: JSON.stringify({ name }),
        expect: 201,
      })
    ).body.data;
  categoryA = await createCategory(sessionA, "Starters");
  categoryB = await createCategory(sessionB, "Starters");

  const createItem = async (session: Session, name: string, price: number, categoryId: string) =>
    (
      await request("/api/v1/menu/items", {
        method: "POST",
        headers: session.headers,
        body: JSON.stringify({ name, price, categoryId }),
        expect: 201,
      })
    ).body.data;
  itemA = await createItem(sessionA, "A Soup", 5, categoryA.id);
  itemB = await createItem(sessionB, "B Soup", 7, categoryB.id);

  const placeOrder = async (token: string, menuItemId: string, quantity: number) =>
    (
      await request(`/api/v1/t/${token}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ menuItemId, quantity }] }),
        expect: 201,
      })
    ).body.data;
  orderA = await placeOrder(tableA.qrCode, itemA.id, 2);
  orderB = await placeOrder(tableB.qrCode, itemB.id, 1);
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await server?.close();

  // Sessions first (they cascade with their users, but the seeded-owner login
  // belongs to no fixture), then every fixture by its recorded slug and email so
  // a run that failed partway still cleans up.
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("tenant identity", () => {
  it("returns each user's own restaurant on login and /me", async () => {
    expect(sessionA.user.restaurant.id).toBe(a.restaurantId);
    expect(sessionB.user.restaurant.id).toBe(b.restaurantId);

    const me = await request("/api/v1/auth/me", { headers: sessionA.headers });
    expect(me.body.data.restaurant).toEqual({
      id: a.restaurantId,
      name: "Isolation A",
    });
  });

  it("rejects an access token that carries no tenant", async () => {
    // A token minted before tenant support (or one stripped of restaurantId)
    // must not reach a scoped service.
    const { signToken, accessTokenSignOptions } = await import(
      "../../src/utils/jwt.js"
    );
    const legacy = signToken(
      // @ts-expect-error — deliberately malformed, as an old token would be.
      { userId: sessionA.user.id, role: "OWNER", status: "ACTIVE" },
      accessTokenSignOptions
    );

    const response = await fetch(`${server.baseUrl}/api/v1/tables`, {
      headers: { Cookie: `accessToken=${legacy}` },
    });
    expect(response.status).toBe(401);
  });
});

describe("per-tenant uniqueness", () => {
  it("lets both restaurants own table 1 and a category named Starters", () => {
    expect(tableA.number).toBe(1);
    expect(tableB.number).toBe(1);
    expect(categoryA.id).not.toBe(categoryB.id);
  });

  it("still rejects a duplicate table number within one restaurant", async () => {
    await request("/api/v1/tables", {
      method: "POST",
      headers: sessionA.headers,
      body: JSON.stringify({ number: 1 }),
      expect: 409,
    });
  });
});

describe("list isolation", () => {
  it("scopes tables, categories and items to the caller", async () => {
    const tables = await request("/api/v1/tables", { headers: sessionA.headers });
    expect(tables.body.data.map((t: { id: string }) => t.id)).toEqual([tableA.id]);

    const categories = await request("/api/v1/menu/categories", {
      headers: sessionA.headers,
    });
    expect(categories.body.data.map((c: { id: string }) => c.id)).toEqual([
      categoryA.id,
    ]);

    const items = await request("/api/v1/menu/items", {
      headers: sessionA.headers,
    });
    expect(items.body.data.map((i: { id: string }) => i.id)).toEqual([itemA.id]);
  });

  it("no longer serves the menu to anonymous callers", async () => {
    await request("/api/v1/menu/items", { expect: 401 });
    await request("/api/v1/menu/categories", { expect: 401 });
  });
});

describe("cross-tenant by-id access", () => {
  it("404s on another restaurant's table", async () => {
    await request(`/api/v1/tables/${tableB.id}`, {
      method: "PATCH",
      headers: sessionA.headers,
      body: JSON.stringify({ number: 42 }),
      expect: 404,
    });
    await request(`/api/v1/tables/${tableB.id}/regenerate-qr`, {
      method: "POST",
      headers: sessionA.headers,
      expect: 404,
    });
    await request(`/api/v1/tables/${tableB.id}`, {
      method: "DELETE",
      headers: sessionA.headers,
      expect: 404,
    });
  });

  it("404s on another restaurant's category", async () => {
    await request(`/api/v1/menu/categories/${categoryB.id}`, {
      method: "PATCH",
      headers: sessionA.headers,
      body: JSON.stringify({ name: "Hijacked" }),
      expect: 404,
    });
    await request(`/api/v1/menu/categories/${categoryB.id}`, {
      method: "DELETE",
      headers: sessionA.headers,
      expect: 404,
    });
  });

  it("404s on another restaurant's menu item", async () => {
    await request(`/api/v1/menu/items/${itemB.id}`, {
      method: "PATCH",
      headers: sessionA.headers,
      body: JSON.stringify({ price: 0.01 }),
      expect: 404,
    });
    await request(`/api/v1/menu/items/${itemB.id}`, {
      method: "DELETE",
      headers: sessionA.headers,
      expect: 404,
    });
  });

  it("leaves the other restaurant's rows untouched", async () => {
    const table = await db.query('SELECT number FROM "Table" WHERE id = $1', [
      tableB.id,
    ]);
    expect(table.rows[0].number).toBe(1);

    const category = await db.query(
      'SELECT name FROM "MenuCategory" WHERE id = $1',
      [categoryB.id]
    );
    expect(category.rows[0].name).toBe("Starters");

    const item = await db.query(
      'SELECT price::text AS price FROM "MenuItem" WHERE id = $1',
      [itemB.id]
    );
    expect(item.rows[0].price).toBe("7.00");
  });

  it("refuses to file an item under another restaurant's category", async () => {
    await request("/api/v1/menu/items", {
      method: "POST",
      headers: sessionA.headers,
      body: JSON.stringify({ name: "Smuggled", price: 3, categoryId: categoryB.id }),
      expect: 400,
    });
  });
});

describe("staff isolation", () => {
  it("refuses to invite an email that belongs to another restaurant", async () => {
    await request("/api/v1/staff/invite", {
      method: "POST",
      headers: sessionA.headers,
      body: JSON.stringify({ fullName: "Hijack", email: b.email, role: "WAITER" }),
      expect: 409,
    });

    const owner = await db.query('SELECT role FROM "User" WHERE id = $1', [
      b.ownerId,
    ]);
    expect(owner.rows[0].role).toBe("OWNER");
  });
});

describe("diner path", () => {
  it("resolves each token to only its own restaurant's menu", async () => {
    const menuA = await request(`/api/v1/t/${tableA.qrCode}`);
    expect(menuA.body.data.items.map((i: { id: string }) => i.id)).toEqual([
      itemA.id,
    ]);

    const menuB = await request(`/api/v1/t/${tableB.qrCode}`);
    expect(menuB.body.data.items.map((i: { id: string }) => i.id)).toEqual([
      itemB.id,
    ]);
  });

  it("rejects ordering another restaurant's item through a token", async () => {
    await request(`/api/v1/t/${tableA.qrCode}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ menuItemId: itemB.id, quantity: 1 }] }),
      expect: 409,
    });
  });

  it("does not read another restaurant's order through a token", async () => {
    await request(`/api/v1/t/${tableB.qrCode}/orders/${orderA.id}`, {
      expect: 404,
    });
  });
});

describe("orders", () => {
  it("isolates the kitchen board", async () => {
    const boardA = await request("/api/v1/orders", { headers: sessionA.headers });
    expect(boardA.body.data.map((o: { id: string }) => o.id)).toEqual([orderA.id]);

    const boardB = await request("/api/v1/orders", { headers: sessionB.headers });
    expect(boardB.body.data.map((o: { id: string }) => o.id)).toEqual([orderB.id]);
  });

  it("404s when advancing another restaurant's order and leaves it PENDING", async () => {
    await request(`/api/v1/orders/${orderB.id}/status`, {
      method: "PATCH",
      headers: sessionA.headers,
      body: JSON.stringify({ status: "PREPARING" }),
      expect: 404,
    });

    const order = await db.query('SELECT status FROM "Order" WHERE id = $1', [
      orderB.id,
    ]);
    expect(order.rows[0].status).toBe("PENDING");
  });

  it("isolates history and sales stats", async () => {
    const historyA = await request("/api/v1/orders/history", {
      headers: sessionA.headers,
    });
    expect(historyA.body.data.total).toBe(1);
    expect(historyA.body.data.orders[0].id).toBe(orderA.id);

    const historyB = await request("/api/v1/orders/history", {
      headers: sessionB.headers,
    });
    expect(historyB.body.data.total).toBe(1);
    expect(historyB.body.data.orders[0].id).toBe(orderB.id);

    const statsA = await request("/api/v1/orders/stats", {
      headers: sessionA.headers,
    });
    const statsB = await request("/api/v1/orders/stats", {
      headers: sessionB.headers,
    });
    expect(statsA.body.data.totalOrders).toBe(1);
    expect(statsB.body.data.totalOrders).toBe(1);
    expect(
      statsA.body.data.byStatus.find(
        (row: { status: string }) => row.status === "PENDING"
      ).count
    ).toBe(1);
  });
});

describe("realtime isolation", () => {
  async function connectStaff(session: Session): Promise<Socket> {
    const { body } = await request("/api/v1/realtime/ticket", {
      headers: session.headers,
    });
    const socket = connect(server.baseUrl, {
      auth: { ticket: body.data.ticket },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("socket connect timeout")), 15_000);
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", (error) => {
        clearTimeout(timer);
        reject(new Error(`socket connect_error: ${String(error)}`));
      });
    });

    return socket;
  }

  it("delivers a new order only to the owning restaurant's staff socket", async () => {
    const socketA = await connectStaff(sessionA);
    const socketB = await connectStaff(sessionB);

    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    socketA.on("order:new", (payload) => receivedA.push(payload));
    socketB.on("order:new", (payload) => receivedB.push(payload));

    await request(`/api/v1/t/${tableA.qrCode}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ menuItemId: itemA.id, quantity: 1 }] }),
      expect: 201,
    });

    // Give the fan-out a beat to land; the assertion is about absence too, so
    // there is nothing to await on.
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);
  });
});

describe("default restaurant regression", () => {
  // This case exists to prove the single-tenant rows folded into
  // `default_restaurant` still work under scoping — which only means anything
  // where that folded data actually is. A disposable test database has no seed,
  // so it reports as skipped rather than failing on absent fixtures.
  it("still works for the seeded restaurant", async (ctx) => {
    const password = process.env.SEED_MANAGER_PASSWORD;
    if (!password) {
      ctx.skip("SEED_MANAGER_PASSWORD is not set");
      return;
    }

    const seeded = await db.query<{ email: string }>(
      `SELECT u.email
         FROM "User" u
         JOIN "Restaurant" r ON r.id = u."restaurantId"
        WHERE r.id = 'default_restaurant'
          AND u.role = 'OWNER'
          AND EXISTS (SELECT 1 FROM "Table" t WHERE t."restaurantId" = r.id)`
    );
    const owner = seeded.rows[0];
    if (!owner) {
      ctx.skip("the dev seed (default_restaurant with tables) is not present");
      return;
    }
    const session = await login(request, owner.email, password);
    expect(session.user.restaurant.id).toBe("default_restaurant");

    const tables = await request("/api/v1/tables", { headers: session.headers });
    expect(tables.body.data.length).toBeGreaterThan(0);

    const items = await request("/api/v1/menu/items", {
      headers: session.headers,
    });
    expect(items.body.data.length).toBeGreaterThan(0);
  });
});
