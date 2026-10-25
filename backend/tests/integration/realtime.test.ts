import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import {
  ORDER_EVENTS,
  SOCKET_AUTH_ERROR,
  type OrderEventPayload,
} from "@plateflow/shared";
import { verifyWsTicket } from "../../src/realtime/ticket.js";
import {
  api,
  db,
  disconnectSockets,
  login,
  newSocket,
  provisionRestaurant,
  removeFixtures,
  removeIssuedRefreshTokens,
  startServer,
  waitForConnect,
  waitForConnectError,
  type Provisioned,
  type Session,
  type TestServer,
} from "../harness.js";

// Sockets are authenticated independently of the REST cookie, so their
// handshake is its own security boundary. A staff ticket must not be usable as
// a session and a diner must only watch the order their table code owns.

let server: TestServer;
let request: ReturnType<typeof api>;
let restaurant: Provisioned;
let owner: Session;
let table: { id: string; qrCode: string };
let otherTable: { id: string; qrCode: string };
let itemId: string;

const json = (method: string, body: unknown) => ({
  method,
  headers: owner.headers,
  body: JSON.stringify(body),
});

async function placeOrder(qrCode: string) {
  const { body } = await request(`/api/v1/t/${qrCode}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ menuItemId: itemId, quantity: 1 }] }),
    expect: 201,
  });
  return body.data.id as string;
}

function nextEvent<T>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${event}`)),
      timeoutMs
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);
  restaurant = await provisionRestaurant("Realtime");
  owner = await login(request, restaurant.email, restaurant.password);

  const category = await request("/api/v1/menu/categories", {
    ...json("POST", { name: "Realtime Dishes" }),
    expect: 201,
  });
  const item = await request("/api/v1/menu/items", {
    ...json("POST", {
      name: "Realtime Soup",
      price: 9,
      categoryId: category.body.data.id,
    }),
    expect: 201,
  });
  itemId = item.body.data.id;

  const createTable = async (number: number) => {
    const { body } = await request("/api/v1/tables", {
      ...json("POST", { number }),
      expect: 201,
    });
    return body.data as { id: string; qrCode: string };
  };
  table = await createTable(1);
  otherTable = await createTable(2);
});

afterAll(async () => {
  disconnectSockets();
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("staff tickets", () => {
  it("requires a staff session", async () => {
    await request("/api/v1/realtime/ticket", { expect: 401 });
  });

  it("mints a ticket carrying the caller's identity and tenant", async () => {
    const { body } = await request("/api/v1/realtime/ticket", {
      headers: owner.headers,
    });

    const claims = verifyWsTicket(body.data.ticket);
    expect(claims).toMatchObject({
      userId: owner.user.id,
      restaurantId: restaurant.restaurantId,
      role: "OWNER",
    });
  });

  it("rejects the session access cookie when offered as a ticket", async () => {
    const socket = newSocket(server.baseUrl, { ticket: owner.accessToken });

    expect(await waitForConnectError(socket)).toBe(SOCKET_AUTH_ERROR);
  });

  it("rejects a connection with no credentials at all", async () => {
    const socket = newSocket(server.baseUrl, {});

    expect(await waitForConnectError(socket)).toBe(SOCKET_AUTH_ERROR);
  });
});

describe("staff fan-out", () => {
  it("pushes a new order to the owning restaurant's staff socket", async () => {
    const { body } = await request("/api/v1/realtime/ticket", {
      headers: owner.headers,
    });
    const socket = newSocket(server.baseUrl, { ticket: body.data.ticket });
    await waitForConnect(socket);

    const received = nextEvent<OrderEventPayload>(socket, ORDER_EVENTS.new);
    const orderId = await placeOrder(table.qrCode);

    const payload = await received;
    expect(payload.order.id).toBe(orderId);
    expect(payload.order.status).toBe("PENDING");
  });
});

describe("diner fan-out", () => {
  it("sends status changes only to the diner watching that order", async () => {
    const orderId = await placeOrder(table.qrCode);
    const otherOrderId = await placeOrder(otherTable.qrCode);

    const watcher = newSocket(server.baseUrl, {
      token: table.qrCode,
      orderId,
    });
    const bystander = newSocket(server.baseUrl, {
      token: otherTable.qrCode,
      orderId: otherOrderId,
    });
    await Promise.all([waitForConnect(watcher), waitForConnect(bystander)]);

    const received = nextEvent<OrderEventPayload>(watcher, ORDER_EVENTS.updated);
    let bystanderReceived: OrderEventPayload | null = null;
    bystander.once(ORDER_EVENTS.updated, (payload: OrderEventPayload) => {
      bystanderReceived = payload;
    });

    await request(`/api/v1/orders/${orderId}/status`, {
      ...json("PATCH", { status: "PREPARING" }),
    });

    const payload = await received;
    expect(payload.order.id).toBe(orderId);
    expect(payload.order.status).toBe("PREPARING");

    // Give the fan-out a beat to land; the assertion is about absence.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(bystanderReceived).toBeNull();
  });

  it("refuses a table code that does not own the order", async () => {
    const orderId = await placeOrder(table.qrCode);
    const socket = newSocket(server.baseUrl, {
      token: otherTable.qrCode,
      orderId,
    });

    expect(await waitForConnectError(socket)).toBe(SOCKET_AUTH_ERROR);
  });

  it("refuses an order id that does not exist", async () => {
    const socket = newSocket(server.baseUrl, {
      token: table.qrCode,
      orderId: "order_does_not_exist",
    });

    expect(await waitForConnectError(socket)).toBe(SOCKET_AUTH_ERROR);
  });
});
