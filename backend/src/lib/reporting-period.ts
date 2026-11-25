import type { OrderReportRange, ReportingPeriod } from "@plateflow/shared";
import { hasCustomReportingDates } from "@plateflow/shared";

if (typeof globalThis.Temporal === "undefined") {
  throw new Error(
    "PlateFlow requires Node.js 26.13.1+ with native Temporal support"
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  // Temporal also accepts fixed UTC offsets; provisioning needs a named IANA
  // zone so daylight-saving transitions remain meaningful.
  if (!timeZone || /^[+-]/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function resolveReportingPeriod(
  timeZone: string,
  range: OrderReportRange = {},
  now = Date.now()
): ReportingPeriod {
  if (!isValidTimeZone(timeZone))
    throw new Error("Restaurant reporting timezone is invalid");
  if (!hasCustomReportingDates(range))
    throw new RangeError(
      "Choose at least a start or end date for a custom range"
    );
  if (!range.preset) {
    return {
      timeZone,
      from: range.from ?? null,
      to: range.to ?? null,
      toExclusive: false,
    };
  }

  const today = Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const boundary = (date: Temporal.PlainDate) =>
    date
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString({ fractionalSecondDigits: 3 });
  let from: string | null = null;
  let to: string | null = null;
  switch (range.preset) {
    case "today":
    case "7d":
    case "30d": {
      const days = range.preset === "7d" ? 7 : range.preset === "30d" ? 30 : 1;
      from = boundary(today.subtract({ days: days - 1 }));
      to = boundary(today.add({ days: 1 }));
      break;
    }
    case "custom":
      if (range.fromDate)
        from = boundary(Temporal.PlainDate.from(range.fromDate));
      if (range.toDate)
        to = boundary(Temporal.PlainDate.from(range.toDate).add({ days: 1 }));
      break;
    case "all":
      break;
  }
  return { timeZone, from, to, toExclusive: true };
}

export function reportingCreatedAt(period: ReportingPeriod) {
  if (!period.from && !period.to) return undefined;
  return {
    ...(period.from ? { gte: new Date(period.from) } : {}),
    ...(period.to
      ? period.toExclusive
        ? { lt: new Date(period.to) }
        : { lte: new Date(period.to) }
      : {}),
  };
}
