import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  collectTableCounts,
  runRestoreChecks,
} from "../../scripts/verify-restore.js";

// Guards the SQL behind the backup/restore drill against schema drift. The
// restore itself needs pg_dump/pg_restore and a scratch branch; this test makes
// sure the verification queries still run and still describe the real schema.

let client: Client;

beforeAll(async () => {
  client = new Client({
    connectionString: process.env.DIRECT_URL,
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

describe("restore verification against the real schema", () => {
  it("passes every check on the baseline database", async () => {
    const results = await runRestoreChecks(client);

    expect(results.filter((result) => !result.ok)).toEqual([]);
  });

  it("reads a row count for every table in the backup contract", async () => {
    const counts = await collectTableCounts(client);

    expect(Object.keys(counts)).toHaveLength(10);
    expect(counts.Restaurant).toBeGreaterThanOrEqual(1);
  });
});
