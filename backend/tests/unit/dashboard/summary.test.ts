import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../src/generated/prisma/client.js";
import type { Role } from "../../../src/generated/prisma/enums.js";
import dashboardService from "../../../src/modules/dashboard/dashboard.service.js";

const queries = vi.hoisted(() => ({
  active: vi.fn(),
  sales: vi.fn(),
  tables: vi.fn(),
  unavailableCount: vi.fn(),
  unavailableItems: vi.fn(),
  restaurant: vi.fn(),
}));

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    restaurant: { findUnique: queries.restaurant },
    order: { findMany: queries.active, aggregate: queries.sales },
    table: { count: queries.tables },
    menuItem: {
      count: queries.unavailableCount,
      findMany: queries.unavailableItems,
    },
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T07:15:00.000Z"));
  queries.active.mockResolvedValue([]);
  queries.sales.mockResolvedValue({ _sum: { total: null } });
  queries.tables.mockResolvedValue(0);
  queries.unavailableCount.mockResolvedValue(0);
  queries.unavailableItems.mockResolvedValue([]);
  queries.restaurant.mockResolvedValue({ timeZone: "Asia/Dhaka" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("dashboard summary", () => {
  it("counts each occupied table once and converts Decimal sales to a number", async () => {
    queries.active.mockResolvedValue([
      { tableId: "one" },
      { tableId: "one" },
      { tableId: "two" },
    ]);
    queries.tables.mockResolvedValue(4);
    queries.sales.mockResolvedValue({
      _sum: { total: new Prisma.Decimal("27.35") },
    });

    expect(await dashboardService.summary("tenant-a", "OWNER")).toMatchObject({
      activeOrders: 3,
      tables: { occupied: 2, total: 4 },
      salesToday: 27.35,
    });
  });

  it.each(["CHEF", "WAITER"] as const)(
    "never queries or returns sales for %s",
    async (role) => {
      queries.sales.mockRejectedValue(
        new Error("Restricted query must not run")
      );

      expect(
        (await dashboardService.summary("tenant-a", role)).salesToday
      ).toBeNull();
      expect(queries.sales).not.toHaveBeenCalled();
    }
  );

  it("fails closed for an unknown future role", async () => {
    expect(
      (await dashboardService.summary("tenant-a", "AUDITOR" as Role)).salesToday
    ).toBeNull();
    expect(queries.sales).not.toHaveBeenCalled();
  });

  it("returns zero sales for management when there are no served orders", async () => {
    expect(
      (await dashboardService.summary("tenant-a", "MANAGER")).salesToday
    ).toBe(0);
    queries.sales.mockResolvedValue({ _sum: { total: null } });
    expect(
      (await dashboardService.summary("tenant-a", "OWNER")).salesToday
    ).toBe(0);
  });

  it("uses a tenant-scoped half-open restaurant day and only active statuses", async () => {
    await dashboardService.summary("tenant-b", "OWNER");

    expect(queries.sales).toHaveBeenCalledWith({
      where: {
        restaurantId: "tenant-b",
        status: "SERVED",
        createdAt: {
          gte: new Date("2026-11-23T18:00:00.000Z"),
          lt: new Date("2026-11-24T18:00:00.000Z"),
        },
      },
      _sum: { total: true },
    });
    expect(queries.active).toHaveBeenCalledWith({
      where: {
        restaurantId: "tenant-b",
        status: { in: ["PENDING", "PREPARING", "READY"] },
      },
      select: { tableId: true },
    });
    expect(queries.tables).toHaveBeenCalledWith({
      where: { restaurantId: "tenant-b" },
    });
    expect(queries.restaurant).toHaveBeenCalledWith({
      where: { id: "tenant-b" },
      select: { timeZone: true },
    });
  });

  it("keeps the full unavailable count when the displayed list is capped", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      name: `Dish ${i}`,
    }));
    queries.unavailableCount.mockResolvedValue(8);
    queries.unavailableItems.mockResolvedValue(items);

    expect(
      (await dashboardService.summary("tenant-a", "OWNER")).outOfStock
    ).toEqual({ count: 8, items });
    expect(queries.unavailableCount).toHaveBeenCalledWith({
      where: { restaurantId: "tenant-a", isAvailable: false },
    });
    expect(queries.unavailableItems).toHaveBeenCalledWith({
      where: { restaurantId: "tenant-a", isAvailable: false },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 5,
    });
  });
});
