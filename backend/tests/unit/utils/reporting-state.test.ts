import { describe, expect, it } from "vitest";
import {
  hasCustomReportingDates,
  reportingPeriodsMatch,
  type ReportingPeriod,
} from "@plateflow/shared";

describe("reporting query and label state", () => {
  it("waits for a custom date while allowing either open-ended bound", () => {
    expect(hasCustomReportingDates({ preset: "custom" })).toBe(false);
    expect(
      hasCustomReportingDates({ preset: "custom", fromDate: "", toDate: "" })
    ).toBe(false);
    expect(
      hasCustomReportingDates({ preset: "custom", fromDate: "2026-11-24" })
    ).toBe(true);
    expect(
      hasCustomReportingDates({ preset: "custom", toDate: "2026-11-24" })
    ).toBe(true);
    expect(hasCustomReportingDates({ preset: "all" })).toBe(true);
    expect(hasCustomReportingDates({ preset: "today" })).toBe(true);
  });

  it("shares a label for identical data periods but not stale or differently interpreted periods", () => {
    const period: ReportingPeriod = {
      timeZone: "Asia/Dhaka",
      from: "2026-11-24T18:00:00Z",
      to: "2026-11-25T18:00:00Z",
      toExclusive: true,
    };
    expect(reportingPeriodsMatch(period, { ...period })).toBe(true);
    for (const change of [
      { timeZone: "UTC" },
      { from: null },
      { to: "2026-11-26T18:00:00Z" },
      { toExclusive: false },
    ]) {
      expect(reportingPeriodsMatch(period, { ...period, ...change })).toBe(
        false
      );
    }
  });
});
