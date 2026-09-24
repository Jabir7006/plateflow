import type {
  OrderStatus,
  RealtimeTicket,
  StaffOrderView,
} from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

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
