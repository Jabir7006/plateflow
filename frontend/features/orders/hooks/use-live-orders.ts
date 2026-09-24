"use client"

import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ORDER_EVENTS,
  SOCKET_AUTH_ERROR,
  type OrderEventPayload,
  type StaffOrderView,
} from "@plateflow/shared"
import { createSocket } from "@/lib/socket"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import { fetchRealtimeTicket, listOrders } from "../api"
import { isActiveStatus } from "../status"

// The one active-orders list the board reads. The socket pushes into this exact
// key, so the components never refetch on a live change.
export const activeOrdersKey = ["orders", "active"] as const

// The socket is the fast path; this only backstops it. If the socket dies for
// good — a genuinely dead session stops the reconnect loop — the board still
// self-heals within one interval instead of freezing until a reload.
const FALLBACK_POLL_MS = 30000

interface UseLiveOrdersOptions {
  // Fired when a genuinely new order arrives over the socket — not on the initial
  // load, and not for status updates — so the board can chime and highlight it.
  onNewOrder?: (order: StaffOrderView) => void
}

function upsert(list: StaffOrderView[], order: StaffOrderView): StaffOrderView[] {
  const i = list.findIndex((o) => o.id === order.id)
  if (i === -1) return [...list, order]
  const next = list.slice()
  next[i] = order
  return next
}

export function useLiveOrders({ onNewOrder }: UseLiveOrdersOptions = {}) {
  const queryClient = useQueryClient()

  const query = useQuery<StaffOrderView[]>({
    queryKey: activeOrdersKey,
    queryFn: listOrders,
    refetchInterval: FALLBACK_POLL_MS,
    refetchOnWindowFocus: true,
  })

  // Read the callback through a ref so a new closure each render doesn't tear the
  // socket down and reconnect.
  const onNewOrderRef = useRef(onNewOrder)
  useEffect(() => {
    onNewOrderRef.current = onNewOrder
  }, [onNewOrder])

  useEffect(() => {
    // Whether the *last* ticket fetch failed because the session is gone (401).
    // A transient failure (deploy, blip, 5xx, offline) leaves this false, so the
    // handshake rejection that follows an empty-auth attempt is treated as
    // retryable rather than fatal.
    let sessionDead = false

    const socket = createSocket((cb) => {
      fetchRealtimeTicket()
        .then(({ ticket }) => {
          sessionDead = false
          cb({ ticket })
        })
        .catch((err) => {
          // handleUnauthorized returns true (and routes to login) only on a 401,
          // which is exactly the "stop trying" case.
          sessionDead = handleUnauthorized(err)
          cb({})
        })
    })

    const handleNew = ({ order }: OrderEventPayload) => {
      let arrived = false
      queryClient.setQueryData<StaffOrderView[]>(activeOrdersKey, (prev) => {
        const list = prev ?? []
        if (list.some((o) => o.id === order.id)) return list
        arrived = true
        return [...list, order]
      })
      if (arrived) onNewOrderRef.current?.(order)
    }

    const handleUpdated = ({ order }: OrderEventPayload) => {
      queryClient.setQueryData<StaffOrderView[]>(activeOrdersKey, (prev) =>
        upsert(prev ?? [], order).filter((o) => isActiveStatus(o.status))
      )
    }

    // Catch up on every (re)connect, including the first. The initial query and
    // the socket join race, and socket.io drops room messages sent before a join,
    // so an order placed in that window is in neither — this refetch, once the
    // socket is in the room, closes that gap as well as any reconnect gap.
    const handleConnect = () => {
      void queryClient.invalidateQueries({ queryKey: activeOrdersKey })
    }

    // Only a genuinely dead session stops the reconnect loop. A transient failure
    // keeps retrying (with a fresh ticket each attempt), so a deploy or blip that
    // coincides with a reconnect doesn't freeze the board for good.
    const handleConnectError = (err: Error) => {
      if (err.message === SOCKET_AUTH_ERROR && sessionDead) socket.disconnect()
    }

    socket.on(ORDER_EVENTS.new, handleNew)
    socket.on(ORDER_EVENTS.updated, handleUpdated)
    socket.on("connect", handleConnect)
    socket.on("connect_error", handleConnectError)

    return () => {
      socket.off(ORDER_EVENTS.new, handleNew)
      socket.off(ORDER_EVENTS.updated, handleUpdated)
      socket.off("connect", handleConnect)
      socket.off("connect_error", handleConnectError)
      socket.disconnect()
    }
  }, [queryClient])

  return query
}
