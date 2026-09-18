const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Human phrasing for how long is left until a deadline ("in 3 days", "in 2
// hours"). Rounds up under an hour so a link with seconds left never claims
// "in 0 minutes".
export function formatDurationUntil(timestamp: string | number | Date): string {
  const remainingMs = new Date(timestamp).getTime() - Date.now()
  if (remainingMs <= 0) return "at any moment"

  const minutes = Math.ceil(remainingMs / MINUTE)
  if (minutes < 60) {
    return `in ${minutes} minute${minutes === 1 ? "" : "s"}`
  }

  const hours = Math.round(remainingMs / HOUR)
  if (hours < 48) {
    return `in ${hours} hour${hours === 1 ? "" : "s"}`
  }

  const days = Math.round(remainingMs / DAY)
  return `in ${days} day${days === 1 ? "" : "s"}`
}
