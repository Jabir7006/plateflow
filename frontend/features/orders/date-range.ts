// Date-range presets for the history + reporting filters. The backend filters on
// createdAt instants and treats the client as the timezone authority, so we turn
// the picked local days into instants: the first instant of the "from" day and the
// last of the "to" day, both in the browser's local zone, serialised as ISO-8601.

export type RangePreset = "today" | "7d" | "30d" | "all" | "custom"

export interface DateRange {
  from?: string
  to?: string
}

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
]

// First instant of a local day (00:00:00.000), as ISO.
const startOfLocalDay = (date: Date): string => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

// Last instant of a local day (23:59:59.999), as ISO.
const endOfLocalDay = (date: Date): string => {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end.toISOString()
}

// A yyyy-mm-dd string from <input type="date"> parsed as a *local* day —
// new Date("2026-09-25") would read it as UTC and shift the boundary.
const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

// The last n days through the end of today, inclusive.
const lastNDays = (n: number): DateRange => {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - (n - 1))
  return { from: startOfLocalDay(from), to: endOfLocalDay(now) }
}

// Resolve a preset (or the two custom date-input values) to createdAt instants.
export function resolveRange(
  preset: RangePreset,
  custom?: { from?: string; to?: string }
): DateRange {
  switch (preset) {
    case "today": {
      const now = new Date()
      return { from: startOfLocalDay(now), to: endOfLocalDay(now) }
    }
    case "7d":
      return lastNDays(7)
    case "30d":
      return lastNDays(30)
    case "custom":
      return {
        from: custom?.from ? startOfLocalDay(parseLocalDate(custom.from)) : undefined,
        to: custom?.to ? endOfLocalDay(parseLocalDate(custom.to)) : undefined,
      }
    case "all":
    default:
      return {}
  }
}
