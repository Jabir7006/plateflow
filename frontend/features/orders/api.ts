import type {
  OrderHistoryResult,
  OrderStats,
  OrderStatus,
  RealtimeTicket,
  StaffOrderView,
} from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"
import type { DateRange } from "./date-range"

export type { StaffOrderView }

// The authenticated staff order surface, through the same-origin /api/v1 proxy so
// the session cookie rides along (unlike the socket, which can't carry it).
export function listOrders(): Promise<StaffOrderView[]> {
  return apiRequest<StaffOrderView[]>("/orders")
}

export function advanceOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<StaffOrderView> {
  return apiRequest<StaffOrderView>(
    `/orders/${encodeURIComponent(orderId)}/status`,
    { method: "PATCH", body: { status } }
  )
}

// A short-lived ticket for the socket.io handshake — the httpOnly cookie can't
// ride the cross-origin socket, so the board trades its session for this first.
export function fetchRealtimeTicket(): Promise<RealtimeTicket> {
  return apiRequest<RealtimeTicket>("/realtime/ticket")
}

export interface OrderHistoryParams {
  page: number
  pageSize: number
  status?: OrderStatus
  from?: string
  to?: string
}

// Serialise only the params that are set — an absent status/range means "all".
function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

// The paged, filterable order record. All staff may read it.
export function getOrderHistory(
  params: OrderHistoryParams
): Promise<OrderHistoryResult> {
  const query = toQueryString({
    page: params.page,
    pageSize: params.pageSize,
    status: params.status,
    from: params.from,
    to: params.to,
  })
  return apiRequest<OrderHistoryResult>(`/orders/history${query}`)
}

// The sales summary for a date range. OWNER/MANAGER only — the backend 403s
// other roles, so callers gate the request behind that check.
export function getOrderStats(range: DateRange): Promise<OrderStats> {
  const query = toQueryString({ from: range.from, to: range.to })
  return apiRequest<OrderStats>(`/orders/stats${query}`)
}

