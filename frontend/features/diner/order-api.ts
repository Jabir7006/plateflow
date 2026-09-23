import type {
  OrderStatusView,
  PlaceOrderSchema,
  PlacedOrder,
} from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export type { OrderStatusView, PlacedOrder }
export type PlaceOrderInput = PlaceOrderSchema["body"]

// Browser-side, through the /api/v1 proxy — unlike the server-only
// features/diner/api.ts that renders the menu. These endpoints are public and
// token-scoped (no session), so no credentials are needed beyond the token in
// the path.
export function placeOrder(
  token: string,
  input: PlaceOrderInput
): Promise<PlacedOrder> {
  return apiRequest<PlacedOrder>(`/t/${encodeURIComponent(token)}/orders`, {
    method: "POST",
    body: input,
  })
}

export function getOrderStatus(
  token: string,
  orderId: string
): Promise<OrderStatusView> {
  return apiRequest<OrderStatusView>(
    `/t/${encodeURIComponent(token)}/orders/${encodeURIComponent(orderId)}`
  )
}
