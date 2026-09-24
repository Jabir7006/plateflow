// Ticket age for the kitchen board: a compact "12m" / "1h 4m" timer plus how
// urgent that age is. The board passes a shared `now` (one ticking clock) so
// every card updates together without each holding its own timer.

const WARN_MIN = 8
const LATE_MIN = 15

export type Urgency = "normal" | "warn" | "late"

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

export function elapsedLabel(iso: string, now: number): string {
  const min = minutesSince(iso, now)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// How long a ticket has waited, bucketed so the card can escalate its colour.
// This is the board's primary "what's late" signal — the standard kitchen-display
// convention where a ticket warms from calm to red as it sits.
export function urgencyLevel(iso: string, now: number): Urgency {
  const min = minutesSince(iso, now)
  if (min >= LATE_MIN) return "late"
  if (min >= WARN_MIN) return "warn"
  return "normal"
}
