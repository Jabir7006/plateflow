import type { OrderReportRange, ReportRangePreset } from "@plateflow/shared"

export type RangePreset = ReportRangePreset
export type DateRange = OrderReportRange

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
]

// Send calendar choices, not browser-local instants. The server's clock and
// stored restaurant timezone are the authority for every reporting range.
export function resolveRange(
  preset: RangePreset,
  custom?: { from?: string; to?: string }
): DateRange {
  return {
    preset,
    ...(preset === "custom"
      ? {
          fromDate: custom?.from || undefined,
          toDate: custom?.to || undefined,
        }
      : {}),
  }
}
