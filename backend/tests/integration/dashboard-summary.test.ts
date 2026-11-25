import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { DashboardSummary } from "@plateflow/shared";
import { randomId } from "../../src/utils/crypto.js";
import { reportingClock } from "../../src/lib/reporting-clock.js";
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

let server: TestServer;
let request: ReturnType<typeof api>;
let tenantA: Provisioned;
let tenantB: Provisioned;
let ownerA: Session;
let ownerB: Session;
let chefA: Session;
let waiterA: Session;
let managerA: Session;
const tableOne = randomId(12);
const tableTwo = randomId(12);
const categoryA = randomId(12);
const unavailableItem = randomId(12);

// Only the reporting clock is fixed; Date and dependency deadlines remain real.
// Raw SQL receives ISO UTC strings: pg's Date serialization uses the process
// timezone, but Prisma's timestamp-without-zone columns store UTC instants.
let today: Date;
let yesterday: Date;
let tomorrow: Date;

beforeAll(async () => {
  await db.connect();
  vi.spyOn(reportingClock, "now").mockReturnValue(
    Date.parse("2026-11-24T20:00:00.000Z")
  );
  today = new Date("2026-11-24T18:00:00.000Z");
  yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  server = await startServer();
  request = api(server.baseUrl);
  tenantA = await provisionRestaurant("Dashboard A", "Asia/Dhaka");
  tenantB = await provisionRestaurant("Dashboard B", "America/Los_Angeles");
  ownerA = await login(request, tenantA.email, tenantA.password);
  ownerB = await login(request, tenantB.email, tenantB.password);
  for (const role of ["CHEF", "WAITER", "MANAGER"] as const) {
    const staff = await createStaffUser({
      restaurantId: tenantA.restaurantId,
      role,
    });
    const session = await login(request, staff.email, staff.password);
    if (role === "CHEF") chefA = session;
    else if (role === "WAITER") waiterA = session;
    else managerA = session;
  }
});

// Each case gets the same reporting baseline, rather than inheriting mutations
// from another test. Users/sessions are shared; all report rows are disposable.
beforeEach(async () => {
  await db.query(
    `INSERT INTO "Table" (id, number, "qrCode", "restaurantId")
     VALUES ($1, 1, $2, $3), ($4, 2, $5, $3)`,
    [tableOne, randomId(32), tenantA.restaurantId, tableTwo, randomId(32)]
  );
  await db.query(
    'INSERT INTO "MenuCategory" (id, name, "restaurantId") VALUES ($1, $2, $3)',
    [categoryA, "Dishes", tenantA.restaurantId]
  );
  for (const [id, name, available] of [
    [randomId(12), "Soup", true],
    [unavailableItem, "Unavailable curry", false],
    [randomId(12), "Rice", true],
  ] as const) {
    await db.query(
      `INSERT INTO "MenuItem" (id, name, price, "isAvailable", "categoryId", "restaurantId")
       VALUES ($1, $2, 10, $3, $4, $5)`,
      [id, name, available, categoryA, tenantA.restaurantId]
    );
  }
  for (const [tableId, status, total, createdAt] of [
    [tableOne, "PENDING", "10", today],
    [tableOne, "PREPARING", "15", today],
    [tableTwo, "SERVED", "27.35", today],
    [tableTwo, "CANCELLED", "50", today],
    [tableTwo, "SERVED", "999", yesterday],
    [tableTwo, "SERVED", "1000", tomorrow],
  ] as const) {
    await db.query(
      `INSERT INTO "Order" (id, "tableId", "restaurantId", status, total, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        randomId(12),
        tableId,
        tenantA.restaurantId,
        status,
        total,
        createdAt.toISOString(),
      ]
    );
  }
});

afterEach(async () => {
  for (const table of ["Order", "MenuItem", "MenuCategory", "Table"]) {
    await db.query(
      `DELETE FROM "${table}" WHERE "restaurantId" = ANY($1::text[])`,
      [[tenantA.restaurantId, tenantB.restaurantId]]
    );
  }
});

afterAll(async () => {
  vi.restoreAllMocks();
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

async function summary(session: Session): Promise<DashboardSummary> {
  const { body } = await request("/api/v1/dashboard/summary", {
    headers: session.headers,
  });
  return body.data;
}

describe("GET /dashboard/summary", () => {
  it("fixes only the reporting clock while real dependency deadlines can advance", async () => {
    const before = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(Date.now()).toBeGreaterThan(before);
    expect(reportingClock.now()).toBe(Date.parse("2026-11-24T20:00:00.000Z"));
  });

  it("rejects empty custom ranges while preserving one-sided date queries", async () => {
    for (const path of ["/api/v1/orders/history", "/api/v1/orders/stats"]) {
      const { body } = await request(`${path}?preset=custom`, {
        headers: ownerA.headers,
        expect: 400,
      });
      expect(
        body.errors.some((error: { message: string }) =>
          error.message.includes("Choose at least a start or end date")
        )
      ).toBe(true);
      await request(`${path}?preset=custom&fromDate=2026-11-25`, {
        headers: ownerA.headers,
      });
      await request(`${path}?preset=custom&toDate=2026-11-25`, {
        headers: ownerA.headers,
      });
    }
  });

  it("reports an invalid tenant timezone clearly and observes a scoped repair immediately", async () => {
    try {
      await db.query('UPDATE "Restaurant" SET "timeZone" = $1 WHERE id = $2', [
        "Mars/City",
        tenantA.restaurantId,
      ]);
      for (const path of [
        "/api/v1/dashboard/summary",
        "/api/v1/orders/history?preset=today",
        "/api/v1/orders/stats?preset=today",
      ]) {
        const { body } = await request(path, {
          headers: ownerA.headers,
          expect: 500,
        });
        expect(body.message).toContain(
          "Restaurant reporting timezone needs correction"
        );
        expect(body.message).not.toContain("Mars/City");
      }
      expect((await summary(ownerB)).period.timeZone).toBe(
        "America/Los_Angeles"
      );
      await db.query(
        'UPDATE "Restaurant" SET "timeZone" = $1 WHERE id = $2 AND "timeZone" = $3',
        ["UTC", tenantA.restaurantId, "Mars/City"]
      );
      expect((await summary(ownerA)).period.timeZone).toBe("UTC");
    } finally {
      await db.query('UPDATE "Restaurant" SET "timeZone" = $1 WHERE id = $2', [
        "Asia/Dhaka",
        tenantA.restaurantId,
      ]);
    }
  });
  it("requires a staff session", async () => {
    await request("/api/v1/dashboard/summary", { expect: 401 });
  });

  it("stores each provisioned timezone and returns server-resolved periods to all staff", async () => {
    const { rows } = await db.query(
      'SELECT id, "timeZone" FROM "Restaurant" WHERE id = ANY($1::text[])',
      [[tenantA.restaurantId, tenantB.restaurantId]]
    );
    expect(rows.find((row) => row.id === tenantA.restaurantId).timeZone).toBe(
      "Asia/Dhaka"
    );
    expect(rows.find((row) => row.id === tenantB.restaurantId).timeZone).toBe(
      "America/Los_Angeles"
    );
    const owner = await summary(ownerA);
    const chef = await summary(chefA);
    expect(chef.period).toEqual(owner.period);
    expect(chef.salesToday).toBeNull();
    const { body } = await request(
      "/api/v1/dashboard/summary?timeZone=Pacific/Auckland",
      { headers: ownerA.headers }
    );
    expect(body.data.period).toEqual(owner.period);
  });

  it("uses the same restaurant day for dashboard, History Today and sales Today", async () => {
    const dashboard = await summary(ownerA);
    const stats = (
      await request("/api/v1/orders/stats?preset=today", {
        headers: ownerA.headers,
      })
    ).body.data;
    const history = (
      await request("/api/v1/orders/history?preset=today", {
        headers: ownerA.headers,
      })
    ).body.data;
    expect(stats.period).toEqual(dashboard.period);
    expect(history.period).toEqual(dashboard.period);
    expect(stats.revenue).toBe(dashboard.salesToday);
    expect(stats.totalOrders).toBe(4);
    expect(history.total).toBe(4);
    expect(history.orders).toHaveLength(4);
    const tomorrow = (
      await request(
        "/api/v1/orders/history?preset=custom&fromDate=2026-11-26&toDate=2026-11-26",
        { headers: ownerA.headers }
      )
    ).body.data;
    expect(tomorrow.total).toBe(1);
    const bHistory = (
      await request("/api/v1/orders/history?preset=today", {
        headers: ownerB.headers,
      })
    ).body.data;
    expect(bHistory.period.timeZone).toBe("America/Los_Angeles");
    expect(bHistory.total).toBe(0);
  });

  it("excludes a UTC-today order from Dhaka-today and includes it in the requested prior local day", async () => {
    await db.query(
      'INSERT INTO "Order" (id, "tableId", "restaurantId", status, total, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 17, $5, $5)',
      [
        randomId(12),
        tableTwo,
        tenantA.restaurantId,
        "SERVED",
        "2026-11-24T16:00:00.000Z",
      ]
    );
    expect((await summary(ownerA)).salesToday).toBe(27.35);
    const { body } = await request(
      "/api/v1/orders/stats?preset=custom&fromDate=2026-11-24&toDate=2026-11-24",
      { headers: ownerA.headers }
    );
    expect(body.data.revenue).toBe(1016); // prior local midnight's 999 + 17
    expect(body.data.period).toMatchObject({
      from: "2026-11-23T18:00:00.000Z",
      to: "2026-11-24T18:00:00.000Z",
      toExclusive: true,
    });
    await request(
      "/api/v1/orders/stats?preset=today&from=2026-11-24T00:00:00Z",
      { headers: ownerA.headers, expect: 400 }
    );
    await request("/api/v1/orders/history?preset=custom&fromDate=2026-02-30", {
      headers: ownerA.headers,
      expect: 400,
    });
  });

  it("summarizes tenant A and includes only today's served sales", async () => {
    expect(await summary(ownerA)).toEqual({
      period: {
        timeZone: "Asia/Dhaka",
        from: "2026-11-24T18:00:00.000Z",
        to: "2026-11-25T18:00:00.000Z",
        toExclusive: true,
      },
      salesToday: 27.35,
      activeOrders: 2,
      tables: { occupied: 1, total: 2 },
      outOfStock: {
        count: 1,
        items: [{ id: unavailableItem, name: "Unavailable curry" }],
      },
    });
  });

  it("allows managers to read sales while chef and waiter responses contain null", async () => {
    expect((await summary(managerA)).salesToday).toBe(27.35);
    for (const session of [chefA, waiterA]) {
      expect(await summary(session)).toMatchObject({
        salesToday: null,
        activeOrders: 2,
        tables: { occupied: 1, total: 2 },
        outOfStock: { count: 1 },
      });
    }
  });

  it("returns zeros for an empty tenant and ignores a client-supplied tenant id", async () => {
    const empty = {
      period: {
        timeZone: "America/Los_Angeles",
        from: "2026-11-24T08:00:00.000Z",
        to: "2026-11-25T08:00:00.000Z",
        toExclusive: true,
      },
      salesToday: 0,
      activeOrders: 0,
      tables: { occupied: 0, total: 0 },
      outOfStock: { count: 0, items: [] },
    };
    expect(await summary(ownerB)).toEqual(empty);
    const { body } = await request(
      `/api/v1/dashboard/summary?restaurantId=${tenantA.restaurantId}`,
      { headers: ownerB.headers }
    );
    expect(body.data).toEqual(empty);
  });

  it("keeps A unchanged when B gains its own table, active order, sales and unavailable item", async () => {
    const before = await summary(ownerA);
    const tableB = randomId(12);
    const categoryB = randomId(12);
    const itemB = randomId(12);
    try {
      await db.query(
        'INSERT INTO "Table" (id, number, "qrCode", "restaurantId") VALUES ($1, 1, $2, $3)',
        [tableB, randomId(32), tenantB.restaurantId]
      );
      await db.query(
        'INSERT INTO "MenuCategory" (id, name, "restaurantId") VALUES ($1, $2, $3)',
        [categoryB, "Dishes", tenantB.restaurantId]
      );
      await db.query(
        'INSERT INTO "MenuItem" (id, name, price, "isAvailable", "categoryId", "restaurantId") VALUES ($1, $2, 10, false, $3, $4)',
        [itemB, "B unavailable", categoryB, tenantB.restaurantId]
      );
      for (const status of ["READY", "SERVED"] as const) {
        await db.query(
          'INSERT INTO "Order" (id, "tableId", "restaurantId", status, total, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 432.10, $5, $5)',
          [
            randomId(12),
            tableB,
            tenantB.restaurantId,
            status,
            today.toISOString(),
          ]
        );
      }
      expect(await summary(ownerA)).toEqual(before);
      expect(await summary(ownerB)).toEqual({
        period: {
          timeZone: "America/Los_Angeles",
          from: "2026-11-24T08:00:00.000Z",
          to: "2026-11-25T08:00:00.000Z",
          toExclusive: true,
        },
        salesToday: 432.1,
        activeOrders: 1,
        tables: { occupied: 1, total: 1 },
        outOfStock: { count: 1, items: [{ id: itemB, name: "B unavailable" }] },
      });
    } finally {
      await db.query('DELETE FROM "Order" WHERE "restaurantId" = $1', [
        tenantB.restaurantId,
      ]);
      await db.query('DELETE FROM "MenuItem" WHERE "restaurantId" = $1', [
        tenantB.restaurantId,
      ]);
      await db.query('DELETE FROM "MenuCategory" WHERE "restaurantId" = $1', [
        tenantB.restaurantId,
      ]);
      await db.query('DELETE FROM "Table" WHERE "restaurantId" = $1', [
        tenantB.restaurantId,
      ]);
    }
  });

  it("counts yesterday's READY order as active and releases its table when served", async () => {
    const id = randomId(12);
    try {
      await db.query(
        'INSERT INTO "Order" (id, "tableId", "restaurantId", status, total, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 300, $5, $5)',
        [id, tableTwo, tenantA.restaurantId, "READY", yesterday.toISOString()]
      );
      expect(await summary(ownerA)).toMatchObject({
        activeOrders: 3,
        tables: { occupied: 2, total: 2 },
        salesToday: 27.35,
      });
      await request(`/api/v1/orders/${id}/status`, {
        method: "PATCH",
        headers: ownerA.headers,
        body: JSON.stringify({ status: "SERVED" }),
      });
      expect(await summary(ownerA)).toMatchObject({
        activeOrders: 2,
        tables: { occupied: 1, total: 2 },
        salesToday: 27.35,
      });
    } finally {
      await db.query(
        'DELETE FROM "Order" WHERE id = $1 AND "restaurantId" = $2',
        [id, tenantA.restaurantId]
      );
    }
  });

  it("returns the exact unavailable count and only the first five names", async () => {
    const ids = Array.from({ length: 6 }, () => randomId(12));
    try {
      for (const [i, id] of ids.entries()) {
        await db.query(
          'INSERT INTO "MenuItem" (id, name, price, "isAvailable", "categoryId", "restaurantId") VALUES ($1, $2, 1, false, $3, $4)',
          [id, `Extra ${i}`, categoryA, tenantA.restaurantId]
        );
      }
      expect((await summary(ownerA)).outOfStock).toEqual({
        count: 7,
        items: ids.slice(0, 5).map((id, i) => ({ id, name: `Extra ${i}` })),
      });
    } finally {
      await db.query(
        'DELETE FROM "MenuItem" WHERE id = ANY($1::text[]) AND "restaurantId" = $2',
        [ids, tenantA.restaurantId]
      );
    }
  });
});
