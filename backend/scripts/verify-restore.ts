import "dotenv/config";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { describeTarget, requireDirectTarget } from "./lib/database-target.js";

// Read-only verification for a restored database. Run it against a scratch
// branch/database after pg_restore (or a Neon restore) and before switching
// production traffic. It checks the things that are cheap to get wrong and
// expensive to discover in production: unfinished migrations, orphaned child
// rows, tenant columns that lost their NOT NULL contract, and a missing
// restaurant anchor.

export interface RestoreCheck {
  name: string;
  sql: string;
  hint: string;
}

export interface RestoreCheckResult {
  name: string;
  ok: boolean;
  failures: number;
  hint: string;
}

// Every query returns a single `failures` column; 0 means healthy. The
// information_schema check returns the number of missing NOT NULL
// restaurantId columns, so a dropped/renamed column fails the drill.
export const RESTORE_CHECKS: readonly RestoreCheck[] = [
  {
    name: "migrations finished",
    sql: `SELECT count(*)::int AS failures
          FROM "_prisma_migrations"
          WHERE finished_at IS NULL`,
    hint: "A migration started but never finished; inspect _prisma_migrations.",
  },
  {
    name: "tenant contract",
    sql: `SELECT (5 - count(*))::int AS failures
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('User', 'MenuCategory', 'MenuItem', 'Table', 'Order')
            AND column_name = 'restaurantId'
            AND is_nullable = 'NO'`,
    hint: "restaurantId must be NOT NULL on every tenant-owned table.",
  },
  {
    name: "restaurant anchor",
    sql: `SELECT CASE WHEN count(*) > 0 THEN 0 ELSE 1 END::int AS failures
          FROM "Restaurant"`,
    hint: "A restored database must contain at least one restaurant.",
  },
  {
    name: "tenant parents",
    sql: `SELECT count(*)::int AS failures
          FROM "User" child
          LEFT JOIN "Restaurant" parent ON parent.id = child."restaurantId"
          WHERE parent.id IS NULL`,
    hint: "User rows point at a restaurant that does not exist.",
  },
  {
    name: "menu categories",
    sql: `SELECT count(*)::int AS failures
          FROM "MenuCategory" child
          LEFT JOIN "Restaurant" parent ON parent.id = child."restaurantId"
          WHERE parent.id IS NULL`,
    hint: "MenuCategory rows point at a restaurant that does not exist.",
  },
  {
    name: "menu items",
    sql: `SELECT count(*)::int AS failures
          FROM "MenuItem" child
          LEFT JOIN "Restaurant" parent ON parent.id = child."restaurantId"
          WHERE parent.id IS NULL`,
    hint: "MenuItem rows point at a restaurant that does not exist.",
  },
  {
    name: "tables",
    sql: `SELECT count(*)::int AS failures
          FROM "Table" child
          LEFT JOIN "Restaurant" parent ON parent.id = child."restaurantId"
          WHERE parent.id IS NULL`,
    hint: "Table rows point at a restaurant that does not exist.",
  },
  {
    name: "orders",
    sql: `SELECT count(*)::int AS failures
          FROM "Order" child
          LEFT JOIN "Restaurant" parent ON parent.id = child."restaurantId"
          WHERE parent.id IS NULL`,
    hint: "Order rows point at a restaurant that does not exist.",
  },
  {
    name: "order items",
    sql: `SELECT count(*)::int AS failures
          FROM "OrderItem" child
          LEFT JOIN "Order" parent ON parent.id = child."orderId"
          WHERE parent.id IS NULL`,
    hint: "OrderItem rows point at an order that does not exist.",
  },
  {
    name: "menu item sizes",
    sql: `SELECT count(*)::int AS failures
          FROM "MenuItemSize" child
          LEFT JOIN "MenuItem" parent ON parent.id = child."menuItemId"
          WHERE parent.id IS NULL`,
    hint: "MenuItemSize rows point at a menu item that does not exist.",
  },
];

export const RESTORE_TABLES = [
  "Restaurant",
  "User",
  "MenuCategory",
  "MenuItem",
  "MenuItemSize",
  "Table",
  "Order",
  "OrderItem",
  "RefreshToken",
  "VerificationToken",
] as const;

export async function runRestoreChecks(
  client: Client
): Promise<RestoreCheckResult[]> {
  const results: RestoreCheckResult[] = [];

  for (const check of RESTORE_CHECKS) {
    const { rows } = await client.query<{ failures: number }>(check.sql);
    const failures = Number(rows[0]?.failures ?? 0);

    results.push({
      name: check.name,
      ok: failures === 0,
      failures,
      hint: check.hint,
    });
  }

  return results;
}

export async function collectTableCounts(
  client: Client
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const table of RESTORE_TABLES) {
    const { rows } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "${table}"`
    );
    counts[table] = Number(rows[0]?.count ?? 0);
  }

  return counts;
}

function printResults(
  target: string,
  results: RestoreCheckResult[],
  counts: Record<string, number>
): void {
  console.log(`Restore target: ${target}`);
  console.log("");

  for (const result of results) {
    const label = result.ok ? "ok" : "FAIL";
    console.log(
      `${label.padEnd(4)} ${result.name.padEnd(22)} failures=${result.failures}`
    );
    if (!result.ok) console.log(`     ${result.hint}`);
  }

  console.log("");
  console.log(
    "Row counts: " +
      RESTORE_TABLES.map((table) => `${table}=${counts[table]}`).join(" ")
  );
}

async function main(): Promise<void> {
  const connectionString =
    process.env.RESTORE_VERIFY_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.error(
      "RESTORE_VERIFY_URL is required (or set DIRECT_URL/DATABASE_URL)."
    );
    process.exit(1);
  }

  try {
    requireDirectTarget(connectionString, "RESTORE_VERIFY_URL");
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error(
      `Could not connect to ${describeTarget(connectionString)}: ` +
        (error as Error).message
    );
    process.exit(1);
  }

  try {
    const results = await runRestoreChecks(client);
    const counts = await collectTableCounts(client);
    printResults(describeTarget(connectionString), results, counts);

    const failures = results.filter((result) => !result.ok);
    if (failures.length > 0) {
      console.error("");
      console.error(
        `Restore verification failed (${failures.length} check(s)). ` +
          "Do not switch traffic to this database."
      );
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("Restore verification passed.");
  } finally {
    await client.end();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await main();
}
