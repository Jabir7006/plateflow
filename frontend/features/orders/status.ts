import type { OrderStatus } from "@plateflow/shared"

// The board only shows orders still in play; SERVED and CANCELLED drop off it.
export function isActiveStatus(status: OrderStatus): boolean {
  return status !== "SERVED" && status !== "CANCELLED"
}

// The working columns, left-to-right in kitchen order. Colour is functional on a
// kitchen display: the dot gives each stage a fixed identity so a glance places a
// ticket without reading the header.
export const BOARD_COLUMNS = [
  { status: "PENDING", title: "New", dot: "bg-amber-500" },
  { status: "PREPARING", title: "Preparing", dot: "bg-blue-500" },
  { status: "READY", title: "Ready", dot: "bg-emerald-500" },
] as const satisfies ReadonlyArray<{
  status: OrderStatus
  title: string
  dot: string
}>

// The same stage colour as a compact pill, for views that mix stages in one list
// (the small-screen "All" filter) where there's no column header to lean on.
export const STATUS_PILL: Partial<Record<OrderStatus, { label: string; className: string }>> = {
  PENDING: { label: "New", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  PREPARING: { label: "Preparing", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  READY: { label: "Ready", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
}

// The single forward step from each active status — the card's primary action.
// The button is tinted toward the stage the ticket moves *into*, so the colour
// always means the same thing; the final bump (→ SERVED) clears the board and
// stays neutral. READY advances to SERVED.
export const NEXT_STATUS: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string; className: string }>
> = {
  PENDING: {
    status: "PREPARING",
    label: "Start preparing",
    className: "bg-blue-600 text-white hover:bg-blue-600/90",
  },
  PREPARING: {
    status: "READY",
    label: "Mark ready",
    className: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  },
  READY: {
    status: "SERVED",
    label: "Mark served",
    className: "",
  },
}
