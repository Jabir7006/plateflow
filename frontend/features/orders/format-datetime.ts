// Absolute order timestamps for the history table. Pinned to en-GB (as the rest
// of the app pins its formatters) so every viewer gets the same 24-hour,
// day-month output the fixed column widths are sized for — a browser-default
// locale would flip to "02:04 PM" and shift the layout. The year is shown only
// when the order isn't from the current year, so "All time" and multi-year
// custom ranges stay unambiguous without widening every row.
const sameYearFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const withYearFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatOrderDateTime(iso: string): string {
  const date = new Date(iso)
  const format =
    date.getFullYear() === new Date().getFullYear()
      ? sameYearFormat
      : withYearFormat
  return format.format(date)
}
