"use client"

import { useQuery } from "@tanstack/react-query"
import type { OrderStatus, OrderStatusView } from "@plateflow/shared"
import { getOrderStatus } from "../order-api"

export const orderStatusKey = (token: string, orderId: string) =>
  ["order", token, orderId] as const

// A placed order stops moving once it's served or cancelled; nothing past those
// is coming, so the page stops polling there.
const TERMINAL: readonly OrderStatus[] = ["SERVED", "CANCELLED"]

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.includes(status)
}

const POLL_MS = 5000

// The single source of truth for one order's status. Today it polls; when the
// kitchen WebSocket lands, a subscription can push straight into this query's
// cache (queryClient.setQueryData(orderStatusKey(...), next)) and refetchInterval
// can drop to false — the components reading this hook won't change.
export function useOrderStatus(token: string, orderId: string) {
  return useQuery<OrderStatusView>({
    queryKey: orderStatusKey(token, orderId),
    queryFn: () => getOrderStatus(token, orderId),
    // Poll while the order is live; stop once it reaches a terminal status.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && isTerminal(status) ? false : POLL_MS
    },
    // Keep polling even if the diner tabs away and back — a "ready" they missed
    // is exactly what they reopen the page to see.
    refetchOnWindowFocus: true,
  })
}
