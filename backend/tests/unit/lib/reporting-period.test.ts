import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  isValidTimeZone,
  reportingCreatedAt,
  resolveReportingPeriod,
} from "../../../src/lib/reporting-period.js";
import { formatReportingPeriod } from "@plateflow/shared";

const now = Date.parse("2026-11-24T20:00:00.000Z");

describe("restaurant reporting periods", () => {
  it("fails at startup when the runtime lacks native Temporal", () => {
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        "delete globalThis.Temporal; await import('./src/lib/reporting-period.ts');",
      ],
      {
        encoding: "utf8",
        timeout: 10_000,
      }
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      "PlateFlow requires Node.js 26.13.1+ with native Temporal support"
    );
  });
  it("uses each restaurant's day independently of the server/browser day", () => {
    const dhaka = resolveReportingPeriod(
      "Asia/Dhaka",
      { preset: "today" },
      now
    );
    const losAngeles = resolveReportingPeriod(
      "America/Los_Angeles",
      { preset: "today" },
      now
    );
    expect(dhaka).toEqual({
      timeZone: "Asia/Dhaka",
      from: "2026-11-24T18:00:00.000Z",
      to: "2026-11-25T18:00:00.000Z",
      toExclusive: true,
    });
    expect(losAngeles).toEqual({
      timeZone: "America/Los_Angeles",
      from: "2026-11-24T08:00:00.000Z",
      to: "2026-11-25T08:00:00.000Z",
      toExclusive: true,
    });
    expect(formatReportingPeriod(dhaka)).toBe("25 Nov 2026 · Asia/Dhaka");
    expect(formatReportingPeriod(losAngeles)).toBe(
      "24 Nov 2026 · America/Los_Angeles"
    );
  });

  it.each([
    ["2026-03-08", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z", 23],
    ["2026-11-01", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z", 25],
  ])("includes the complete DST day %s", (date, from, to, hours) => {
    const period = resolveReportingPeriod(
      "America/New_York",
      { preset: "custom", fromDate: date as string, toDate: date as string },
      now
    );
    expect(period).toMatchObject({ from, to, toExclusive: true });
    expect(
      (Date.parse(period.to!) - Date.parse(period.from!)) / 3_600_000
    ).toBe(hours);
    expect(reportingCreatedAt(period)).toEqual({
      gte: new Date(from as string),
      lt: new Date(to as string),
    });
  });

  it("supports a non-hour timezone offset", () => {
    expect(
      resolveReportingPeriod("Asia/Kathmandu", { preset: "today" }, now)
    ).toMatchObject({
      from: "2026-11-24T18:15:00.000Z",
      to: "2026-11-25T18:15:00.000Z",
    });
  });

  it("handles a skipped local calendar day without fabricating a 24-hour window", () => {
    const period = resolveReportingPeriod(
      "Pacific/Apia",
      { preset: "custom", fromDate: "2011-12-30", toDate: "2011-12-30" },
      now
    );
    expect(period.from).toBe(period.to);
    expect(formatReportingPeriod(period)).toBe(
      "Empty reporting period · Pacific/Apia"
    );
  });

  it.each([
    ["7d", "2026-11-18T18:00:00.000Z"],
    ["30d", "2026-10-26T18:00:00.000Z"],
  ] as const)(
    "resolves %s using calendar days through today",
    (preset, from) => {
      expect(
        resolveReportingPeriod("Asia/Dhaka", { preset }, now)
      ).toMatchObject({ from, to: "2026-11-25T18:00:00.000Z" });
    }
  );

  it("includes the custom end day and supports one-sided/all-time bounds", () => {
    const period = resolveReportingPeriod(
      "Asia/Dhaka",
      { preset: "custom", fromDate: "2026-11-23", toDate: "2026-11-24" },
      now
    );
    expect(period).toMatchObject({
      from: "2026-11-22T18:00:00.000Z",
      to: "2026-11-24T18:00:00.000Z",
    });
    expect(formatReportingPeriod(period)).toBe(
      "23 Nov 2026 – 24 Nov 2026 · Asia/Dhaka"
    );
    expect(
      resolveReportingPeriod(
        "Asia/Dhaka",
        { preset: "custom", toDate: "2026-11-24" },
        now
      ).from
    ).toBeNull();
    const all = resolveReportingPeriod("Asia/Dhaka", { preset: "all" }, now);
    expect(reportingCreatedAt(all)).toBeUndefined();
    expect(formatReportingPeriod(all)).toBe("All dates · Asia/Dhaka");
  });

  it("does not silently turn an empty custom period into all time", () => {
    expect(() =>
      resolveReportingPeriod("Asia/Dhaka", { preset: "custom" }, now)
    ).toThrow("Choose at least a start or end date for a custom range");
  });

  it("preserves legacy inclusive explicit ISO bounds", () => {
    const from = "2026-11-24T00:00:00Z";
    const to = "2026-11-24T23:59:59.999Z";
    const period = resolveReportingPeriod("Asia/Dhaka", { from, to }, now);
    expect(period).toEqual({
      timeZone: "Asia/Dhaka",
      from,
      to,
      toExclusive: false,
    });
    expect(reportingCreatedAt(period)).toEqual({
      gte: new Date(from),
      lte: new Date(to),
    });
  });

  it("rejects invalid or offset-only provisioning timezone values", () => {
    for (const zone of ["UTC", "Asia/Dhaka", "America/New_York"])
      expect(isValidTimeZone(zone)).toBe(true);
    for (const zone of ["", "Mars/City", "+06:00", "-05:00"])
      expect(isValidTimeZone(zone)).toBe(false);
    expect(() =>
      resolveReportingPeriod("Mars/City", { preset: "today" }, now)
    ).toThrow("Restaurant reporting timezone is invalid");
  });
});
