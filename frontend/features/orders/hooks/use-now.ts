"use client"

import { useEffect, useState } from "react"

// One shared clock for the board. Ticket timers and urgency are derived from a
// timestamp, so without a periodic re-render an idle board would freeze at "2m"
// while orders quietly age. This ticks every `intervalMs` (15s is enough for a
// minute-resolution timer) and lets every card read the same `now`.
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
