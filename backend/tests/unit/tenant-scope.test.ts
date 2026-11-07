import { describe, expect, it } from "vitest";
import {
  analyzeSource,
  analyzeTenantScopes,
  type ScopeAllowlistEntry,
} from "./lib/tenant-scope.js";

// Tenant isolation is enforced by convention: every service threads
// `restaurantId` explicitly. This guard is what makes that convention hold —
// a new Prisma call that forgets the tenant fails the unit suite instead of
// leaking another restaurant's rows.

const scan = (source: string) => analyzeSource("src/example.ts", source);

const messages = (source: string) => scan(source).map((violation) => violation.message);

describe("tenant-scope guard (repository)", () => {
  it("scopes every Prisma call on a tenant-owned model", () => {
    const result = analyzeTenantScopes();

    expect(
      result.violations.map((violation) => violation.message),
      [
        "Every Prisma query on a tenant-owned model must prove its restaurant.",
        "Add restaurantId to the where/data clause. If the read is intentionally",
        "global, add an allowlist entry in tests/unit/lib/tenant-scope.ts with a reason.",
      ].join(" ")
    ).toEqual([]);
  });

  it("has no stale or duplicate allowlist entries", () => {
    const result = analyzeTenantScopes();

    expect(
      result.unusedAllowlist.map(
        (entry) =>
          `${entry.file} [${entry.functionName}] ${entry.model}.${entry.method}`
      ),
      "An allowlist entry no longer matches a call. Delete it or fix its shape."
    ).toEqual([]);

    expect(
      result.duplicateAllowlist.map((entry) => entry.reason),
      "Two allowlist entries describe the same call. Keep one."
    ).toEqual([]);
  });

  it("actually scans the service layer", () => {
    // A broken path or an empty glob would make the guard silently pass.
    expect(analyzeTenantScopes().filesScanned).toBeGreaterThan(5);
  });
});

describe("tenant-scope guard (analysis)", () => {
  it("flags a list query with no tenant filter", () => {
    const violations = messages(`
      async function listOrders() {
        return prisma.order.findMany({ where: { status: "PENDING" } });
      }
    `);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("order.findMany");
    expect(violations[0]).toContain("no restaurant scope");
  });

  it("accepts a direct or shorthand restaurantId", () => {
    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({ where: { restaurantId } });
        }
      `)
    ).toEqual([]);

    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({ where: { restaurantId: restaurantId } });
        }
      `)
    ).toEqual([]);
  });

  it("resolves a where clause held in a local const", () => {
    expect(
      messages(`
        async function listOrders(restaurantId: string, status: string) {
          const where: any = { restaurantId, status };
          return prisma.order.findMany({ where });
        }
      `)
    ).toEqual([]);
  });

  it("fails an unresolved where clause instead of trusting it", () => {
    expect(
      messages(`
        async function listOrders(where: any) {
          return prisma.order.findMany({ where });
        }
      `)
    ).toHaveLength(1);
  });

  it("accepts AND nesting but rejects a partly unscoped OR", () => {
    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({
            where: { AND: [{ restaurantId }, { status: "PENDING" }] },
          });
        }
      `)
    ).toEqual([]);

    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({
            where: { OR: [{ restaurantId }, { status: "SERVED" }] },
          });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({
            where: { OR: [{ restaurantId }, { restaurantId, status: "SERVED" }] },
          });
        }
      `)
    ).toEqual([]);
  });

  it("does not treat a widening restaurantId filter as scope", () => {
    // Negation and multi-tenant lists both match more than one restaurant.
    for (const filter of [
      "{ not: restaurantId }",
      "{ notIn: [restaurantId] }",
      "{ in: [restaurantId, otherId] }",
    ]) {
      expect(
        messages(`
          async function listOrders(restaurantId: string, otherId: string) {
            return prisma.order.findMany({
              where: { restaurantId: ${filter} },
            });
          }
        `)
      ).toHaveLength(1);
    }

    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({
            where: { NOT: { restaurantId } },
          });
        }
      `)
    ).toHaveLength(1);
  });

  it("accepts an explicit equals filter", () => {
    expect(
      messages(`
        async function listOrders(restaurantId: string) {
          return prisma.order.findMany({
            where: { restaurantId: { equals: restaurantId } },
          });
        }
      `)
    ).toEqual([]);
  });

  it("accepts the public QR anchors", () => {
    // Diner menu lookup: the QR token is the tenant anchor.
    expect(
      messages(`
        async function menu(token: string) {
          return prisma.table.findUnique({ where: { qrCode: token } });
        }
      `)
    ).toEqual([]);

    // Diner order status: the order must belong to the token's table.
    expect(
      messages(`
        async function status(token: string, orderId: string) {
          return prisma.order.findFirst({
            where: { id: orderId, table: { qrCode: token } },
          });
        }
      `)
    ).toEqual([]);
  });

  it("requires the tenant in create data", () => {
    expect(
      messages(`
        async function createItem(name: string) {
          return prisma.menuItem.create({ data: { name } });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function createItem(name: string, restaurantId: string) {
          return prisma.menuItem.create({ data: { name, restaurantId } });
        }
      `)
    ).toEqual([]);

    // A relation connect sets the FK too.
    expect(
      messages(`
        async function createItem(name: string, restaurantId: string) {
          return prisma.menuItem.create({
            data: { name, restaurant: { connect: { id: restaurantId } } },
          });
        }
      `)
    ).toEqual([]);
  });

  it("does not accept undefined as a tenant value", () => {
    // Prisma drops undefined keys, so `restaurantId: undefined` would create an
    // orphan row or silently read across tenants.
    expect(
      messages(`
        async function listOrders() {
          return prisma.order.findMany({ where: { restaurantId: undefined } });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function createItem(name: string) {
          return prisma.menuItem.create({ data: { name, restaurantId: undefined } });
        }
      `)
    ).toHaveLength(1);
  });

  it("checks every row of createMany", () => {
    expect(
      messages(`
        async function createItems(restaurantId: string) {
          return prisma.menuItem.createMany({
            data: [{ restaurantId, name: "A" }, { name: "B" }],
          });
        }
      `)
    ).toHaveLength(1);
  });

  it("ignores global token models but not child models", () => {
    expect(
      messages(`
        async function invite(token: string) {
          return prisma.verificationToken.findUnique({ where: { token } });
        }
      `)
    ).toEqual([]);

    // OrderItem/MenuItemSize inherit tenancy: a standalone query must prove the
    // parent's tenant, and a create must set the parent FK.
    expect(
      messages(`
        async function items(orderId: string) {
          return prisma.orderItem.findMany({ where: { orderId } });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function items(restaurantId: string) {
          return prisma.orderItem.findMany({
            where: { order: { restaurantId } },
          });
        }
      `)
    ).toEqual([]);

    expect(
      messages(`
        async function add(orderId: string) {
          return prisma.orderItem.create({
            data: { orderId, nameSnapshot: "Tea", quantity: 1 },
          });
        }
      `)
    ).toEqual([]);

    expect(
      messages(`
        async function add() {
          return prisma.orderItem.create({
            data: { nameSnapshot: "Tea", quantity: 1 },
          });
        }
      `)
    ).toHaveLength(1);
  });

  it("forbids moving a row to another tenant through update data", () => {
    expect(
      messages(`
        async function move(id: string, restaurantId: string, otherId: string) {
          return prisma.order.update({
            where: { id, restaurantId },
            data: { restaurantId: otherId },
          });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function reParent(id: string, restaurantId: string, orderId: string) {
          return prisma.orderItem.update({
            where: { id, order: { restaurantId } },
            data: { orderId },
          });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function rename(id: string, restaurantId: string) {
          return prisma.menuItem.update({
            where: { id, restaurantId },
            data: { name: "Tea" },
          });
        }
      `)
    ).toEqual([]);
  });

  it("fails closed on an unclassified model or method", () => {
    expect(
      messages(`
        async function all() {
          return prisma.receipt.findMany({ where: { restaurantId } });
        }
      `)
    ).toHaveLength(1);

    expect(
      messages(`
        async function all(restaurantId: string) {
          return prisma.order.someFutureMethod({ where: { restaurantId } });
        }
      `)
    ).toHaveLength(1);
  });

  it("flags raw SQL, which cannot be verified statically", () => {
    expect(messages("const rows = prisma.$queryRaw`SELECT 1`;")).toHaveLength(1);
    expect(messages("const rows = prisma.$queryRawUnsafe('SELECT 1');")).toHaveLength(1);
  });

  it("follows the $transaction client parameter", () => {
    expect(
      messages(`
        async function move(restaurantId: string) {
          return prisma.$transaction(async (client) => {
            return client.order.updateMany({
              where: { restaurantId },
              data: { status: "READY" },
            });
          });
        }
      `)
    ).toEqual([]);

    expect(
      messages(`
        async function move() {
          return prisma.$transaction(async (client) => {
            return client.order.updateMany({ data: { status: "READY" } });
          });
        }
      `)
    ).toHaveLength(1);
  });

  it("lets an allowlist entry suppress exactly one shape", () => {
    const source = `
      async function login(email: string) {
        return prisma.user.findUnique({ where: { email } });
      }
    `;
    const entry: ScopeAllowlistEntry = {
      file: "src/example.ts",
      functionName: "login",
      model: "user",
      method: "findUnique",
      kind: "where",
      keys: ["email"],
      reason: "test fixture",
    };
    const usage = new Map([[entry, 0]]);

    expect(analyzeSource("src/example.ts", source, usage)).toEqual([]);
    expect(usage.get(entry)).toBe(1);

    // Same file/function/model/method, different where shape: not covered.
    const reshaped = new Map([[entry, 0]]);
    const violations = analyzeSource(
      "src/example.ts",
      `
        async function login(id: string) {
          return prisma.user.findUnique({ where: { id } });
        }
      `,
      reshaped
    );

    expect(violations).toHaveLength(1);
    expect(reshaped.get(entry)).toBe(0);
  });

  it("does not match an allowlist entry from another function", () => {
    const entry: ScopeAllowlistEntry = {
      file: "src/example.ts",
      functionName: "login",
      model: "user",
      method: "findUnique",
      kind: "where",
      keys: ["email"],
      reason: "test fixture",
    };
    const usage = new Map([[entry, 0]]);

    const violations = analyzeSource(
      "src/example.ts",
      `
        async function findByEmail(email: string) {
          return prisma.user.findUnique({ where: { email } });
        }
      `,
      usage
    );

    expect(violations).toHaveLength(1);
    expect(usage.get(entry)).toBe(0);
  });
});
