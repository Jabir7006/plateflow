import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import {
  RESTORE_CHECKS,
  runRestoreChecks,
} from "../../../scripts/verify-restore.js";

const fakeClient = (failures: number) =>
  ({
    query: async () => ({ rows: [{ failures }] }),
  }) as unknown as Client;

describe("runRestoreChecks", () => {
  it("runs every check and passes a healthy restore", async () => {
    const results = await runRestoreChecks(fakeClient(0));

    expect(results).toHaveLength(RESTORE_CHECKS.length);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.every((result) => result.failures === 0)).toBe(true);
  });

  it("fails the drill when any check reports an orphan or contract break", async () => {
    const results = await runRestoreChecks(fakeClient(2));

    expect(results).toHaveLength(RESTORE_CHECKS.length);
    expect(results.every((result) => !result.ok)).toBe(true);
    expect(results[0].failures).toBe(2);
    expect(results[0].hint).toBeTruthy();
  });
});
