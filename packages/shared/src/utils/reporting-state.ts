import type {
  OrderReportRange,
  ReportingPeriod,
} from "../types/reporting.types.js";

export function hasCustomReportingDates(range: OrderReportRange): boolean {
  return range.preset !== "custom" || Boolean(range.fromDate || range.toDate);
}

// Labels may be shared only when both independently fetched datasets describe
// the same window, timezone and endpoint semantics. Range changes can briefly
// leave the history table and sales card showing different cached periods.
export function reportingPeriodsMatch(
  a: ReportingPeriod,
  b: ReportingPeriod,
): boolean {
  return (
    a.timeZone === b.timeZone &&
    a.from === b.from &&
    a.to === b.to &&
    a.toExclusive === b.toExclusive
  );
}
