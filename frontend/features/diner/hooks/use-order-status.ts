"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ORDER_EVENTS,
  SOCKET_AUTH_ERROR,
  type OrderEventPayload,
  type OrderStatus,
  type OrderStatusView,
} from "@plateflow/shared"
import { createSocket } from "@/lib/socket"
import { getOrderStatus } from "../order-api"

export const orderStatusKey = (token: string, orderId: string) =>
  ["order", token, orderId] as const

// A placed order stops moving once it's served or cancelled; nothing past those
// is coming, so the page stops listening there.
const TERMINAL: readonly OrderStatus[] = ["SERVED", "CANCELLED"]

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.includes(status)
}

// The kitchen pushes every status change over the socket, so this is the fast
// path; polling stays only as a slow fallback for a dropped socket, and stops
// once the order reaches a terminal status.
const FALLBACK_POLL_MS = 20000

// The single source of truth for one order's status. The socket subscription
// pushes updates straight into this query's cache, so the components reading the
// hook never change and never wait on a poll for a live update.
export function useOrderStatus(token: string, orderId: string) {
  const queryClient = useQueryClient()
  const key = orderStatusKey(token, orderId)

  const query = useQuery<OrderStatusView>({
    queryKey: key,
    queryFn: () => getOrderStatus(token, orderId),
    refetchInterval: (q) => {
      const status = q.state.data?.status
      return status && isTerminal(status) ? false : FALLBACK_POLL_MS
    },
    // Keep the fallback polling even if the diner tabs away and back — a "ready"
    // they missed is exactly what they reopen the page to see.
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    // The table token + order id are the same public capability the REST read
    // uses; the server re-checks the order belongs to this token before it joins
    // the room, so a wrong-token link simply receives nothing.
    const socket = createSocket({ token, orderId })

    const handleUpdated = ({ order }: OrderEventPayload) => {
      queryClient.setQueryData(orderStatusKey(token, orderId), order)
    }
    // Catch up on every (re)connect, including the first. The mount query and the
    // socket join race, and socket.io drops room messages sent before a join, so
    // a status change in that window would be missed until the poll; refetching
    // once the socket is in the room closes that gap and any reconnect gap.
    const handleConnect = () => {
      void queryClient.invalidateQueries({
        queryKey: orderStatusKey(token, orderId),
      })
    }
    // A wrong or rotated token is refused at the handshake; stop reconnecting on
    // that (it also spares the server a DB lookup per retry). The REST poll below
    // still surfaces the not-found state. Transient drops keep reconnecting.
    const handleConnectError = (err: Error) => {
      if (err.message === SOCKET_AUTH_ERROR) socket.disconnect()
    }

    socket.on(ORDER_EVENTS.updated, handleUpdated)
    socket.on("connect", handleConnect)
    socket.on("connect_error", handleConnectError)

    return () => {
      socket.off(ORDER_EVENTS.updated, handleUpdated)
      socket.off("connect", handleConnect)
      socket.off("connect_error", handleConnectError)
      socket.disconnect()
    }
  }, [token, orderId, queryClient])

  return query
}
