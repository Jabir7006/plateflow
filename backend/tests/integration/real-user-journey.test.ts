import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The invitation path is the only feature in this journey that needs an external
// provider; mock the mail call so the test asserts the flow, not Resend uptime.
vi.mock("../../src/lib/mail.js", () => ({
  sendEmail: vi.fn(),
}));

import {
  ORDER_EVENTS,
  type OrderEventPayload,
  type TableMenu,
} from "@plateflow/shared";
import { sendEmail } from "../../src/lib/mail.js";
import {
  api,
  db,
  disconnectSockets,
  login,
  newSocket,
  nextEvent,
  provisionRestaurant,
  removeFixtures,
  removeIssuedRefreshTokens,
  startServer,
  waitForConnect,
  type Provisioned,
  type Session,
  type TestServer,
} from "../harness.js";

// One restaurant's real day, driven only through the public API and sockets:
// operator provisions → owner builds the menu and a table → diner scans the QR,
// orders, and watches status → staff work the board → reporting → invite a
// waiter → a second restaurant proves the tenant boundary. Each feature has its
// own focused suite; this one proves they work together as a user experiences
// them, rather than only in isolation.

const mail = vi.mocked(sendEmail);

let server: TestServer;
let request: ReturnType<typeof api>;

let restaurant: Provisioned;
let owner: Session;
let table: { id: string; qrCode: string };
let burger: MenuItemView;
let fries: MenuItemView;
let soldOut: MenuItemView;

interface MenuItemView {
  id: string;
  name: string;
  price: number;
  sizes: { id: string; label: string; price: number }[];
}

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
  return body.data as MenuItemView;
}

async function createTable(session: Session, number: number) {
  const { body } = await request("/api/v1/tables", {
    ...json("POST", { number }, session.headers),
    expect: 201,
  });
  return body.data as { id: string; qrCode: string };
}

async function advance(
  session: Session,
  orderId: string,
  status: string,
  expectStatus = 200
) {
  await request(`/api/v1/orders/${orderId}/status`, {
    ...json("PATCH", { status }, session.headers),
    expect: expectStatus,
  });
}

function sentInvite() {
  const call = mail.mock.calls.at(-1);
  if (!call) throw new Error("sendEmail was not called");

  const token = call[0].text.match(/accept-invite\?token=([A-Za-z0-9_-]+)/)?.[1];
  if (!token) throw new Error("the invite email carried no token");
  return token;
}

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);

  restaurant = await provisionRestaurant("Journey Bistro");
  owner = await login(request, restaurant.email, restaurant.password);

  const mains = await createCategory(owner, "Mains");
  burger = await createItem(owner, {
    name: "Burger",
    price: 12,
    categoryId: mains.id,
    sizes: [
      { label: "Small", price: 8 },
      { label: "Large", price: 15 },
    ],
  });
  fries = await createItem(owner, {
    name: "Fries",
    price: 4,
    categoryId: mains.id,
  });
  soldOut = await createItem(owner, {
    name: "Sold Out Special",
    price: 99,
    categoryId: mains.id,
    isAvailable: false,
  });

  table = await createTable(owner, 7);
});

afterAll(async () => {
  disconnectSockets();
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("a real user journey", () => {
  it("serves a diner from QR scan to reporting, then onboards staff", async () => {
    // 0. Production health check, the probe a deploy platform calls.
    const health = await request("/health");
    expect(health.body).toEqual({ status: "ok" });

    // 1. The owner's session names the restaurant, and the diner's QR resolves
    //    only the available menu of that restaurant.
    expect(owner.user.restaurant).toEqual({
      id: restaurant.restaurantId,
      name: "Journey Bistro",
    });

    const scanned = await request(`/api/v1/t/${table.qrCode}`);
    const menu = scanned.body.data as TableMenu;
    expect(menu.table.number).toBe(7);
    const menuNames = menu.items.map((item) => item.name);
    expect(menuNames).toContain("Burger");
    expect(menuNames).toContain("Fries");
    expect(menuNames).not.toContain(soldOut.name);

    // 2. Staff open the live board: a ticket, then a real socket in their room.
    const ticket = await request("/api/v1/realtime/ticket", {
      headers: owner.headers,
    });
    const staffSocket = newSocket(server.baseUrl, {
      ticket: ticket.body.data.ticket,
    });
    await waitForConnect(staffSocket);

    // 3. A diner orders a large burger + fries. The server prices it from the
    //    menu (8/15 sizes, 4 fries), never from the client.
    const large = burger.sizes.find((size) => size.label === "Large")!;
    const newOrderEvent = nextEvent<OrderEventPayload>(
      staffSocket,
      ORDER_EVENTS.new
    );

    const placed = await request(`/api/v1/t/${table.qrCode}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { menuItemId: burger.id, quantity: 1, sizeId: large.id },
          { menuItemId: fries.id, quantity: 1 },
        ],
        note: "No onions",
      }),
      expect: 201,
    });
    const orderId = placed.body.data.id as string;

    const pushed = await newOrderEvent;
    expect(pushed.order.id).toBe(orderId);
    expect(pushed.order.status).toBe("PENDING");
    expect(pushed.order.total).toBe(19);

    // 4. The diner watches this order only.
    const dinerSocket = newSocket(server.baseUrl, {
      token: table.qrCode,
      orderId,
    });
    await waitForConnect(dinerSocket);

    // 5. Staff walk the forward-only lifecycle; each step reaches the diner.
    for (const status of ["PREPARING", "READY", "SERVED"]) {
      const updated = nextEvent<OrderEventPayload>(
        dinerSocket,
        ORDER_EVENTS.updated
      );
      await advance(owner, orderId, status);
      expect((await updated).order.status).toBe(status);
    }

    // 6. The diner's own status page shows the finished order and its lines.
    const status = await request(`/api/v1/t/${table.qrCode}/orders/${orderId}`);
    expect(status.body.data.status).toBe("SERVED");
    expect(status.body.data.tableNumber).toBe(7);
    expect(status.body.data.total).toBe(19);
    expect(status.body.data.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Burger", sizeLabel: "Large", quantity: 1 }),
        expect.objectContaining({ name: "Fries", sizeLabel: null, quantity: 1 }),
      ])
    );

    // 7. The board is empty again; history and revenue retain the order.
    const board = await request("/api/v1/orders", { headers: owner.headers });
    expect(board.body.data).toEqual([]);

    const history = await request("/api/v1/orders/history?page=1&pageSize=10", {
      headers: owner.headers,
    });
    expect(history.body.data.orders).toHaveLength(1);
    expect(history.body.data.orders[0].id).toBe(orderId);
    expect(history.body.data.orders[0].status).toBe("SERVED");

    const stats = await request("/api/v1/orders/stats", {
      headers: owner.headers,
    });
    expect(stats.body.data.totalOrders).toBe(1);
    expect(stats.body.data.revenue).toBe(19);

    // 8. The owner invites a waiter; the invitee accepts and can work the board
    //    but not see money or manage staff.
    mail.mockResolvedValue(undefined);
    const inviteeEmail = `journey-waiter-${Date.now()}@example.com`;
    await request("/api/v1/staff/invite", {
      ...json(
        "POST",
        { fullName: "Journey Waiter", email: inviteeEmail, role: "WAITER" },
        owner.headers
      ),
      expect: 201,
    });

    const inviteToken = sentInvite();
    const preview = await request(
      `/api/v1/auth/verify-invite?token=${encodeURIComponent(inviteToken)}`
    );
    expect(preview.body.data.email).toBe(inviteeEmail);

    const accepted = await request("/api/v1/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: inviteToken,
        password: "JourneyPass123!",
      }),
      expect: 201,
    });
    expect(accepted.body.data.restaurant.id).toBe(restaurant.restaurantId);

    const waiter = await login(request, inviteeEmail, "JourneyPass123!");
    const waiterBoard = await request("/api/v1/orders", {
      headers: waiter.headers,
    });
    expect(waiterBoard.body.data).toEqual([]);

    await request("/api/v1/orders/stats", {
      headers: waiter.headers,
      expect: 403,
    });
    await request("/api/v1/staff/invite", {
      ...json(
        "POST",
        { fullName: "Nope", email: "nope@example.com", role: "WAITER" },
        waiter.headers
      ),
      expect: 403,
    });

    // 9. A second restaurant sees none of it: empty board/history/revenue, and
    //    the first restaurant's order id is a 404 across the tenant boundary.
    const other = await provisionRestaurant("Journey Other");
    const otherOwner = await login(request, other.email, other.password);

    const otherBoard = await request("/api/v1/orders", {
      headers: otherOwner.headers,
    });
    expect(otherBoard.body.data).toEqual([]);

    const otherHistory = await request(
      "/api/v1/orders/history?page=1&pageSize=10",
      { headers: otherOwner.headers }
    );
    expect(otherHistory.body.data.total).toBe(0);

    const otherStats = await request("/api/v1/orders/stats", {
      headers: otherOwner.headers,
    });
    expect(otherStats.body.data.revenue).toBe(0);

    await request(`/api/v1/orders/${orderId}/status`, {
      ...json("PATCH", { status: "PREPARING" }, otherOwner.headers),
      expect: 404,
    });
  });
});
