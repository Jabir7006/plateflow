import type { ReportingPeriod } from "../types/reporting.types.js";

export function formatReportingPeriod(period: ReportingPeriod): string {
  if (
    period.toExclusive &&
    period.from &&
    period.to &&
    period.from === period.to
  ) {
    return `Empty reporting period · ${period.timeZone}`;
  }
  const format = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: period.timeZone,
  });
  const from = period.from ? format.format(new Date(period.from)) : null;
  const to = period.to
    ? format.format(
        new Date(Date.parse(period.to) - (period.toExclusive ? 1 : 0)),
      )
    : null;
  const dates =
    from && to
      ? from === to
        ? from
        : `${from} – ${to}`
      : from
        ? `From ${from}`
        : to
          ? `Through ${to}`
          : "All dates";
  return `${dates} · ${period.timeZone}`;
}
