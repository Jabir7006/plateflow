"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { OrderStatus, StaffOrderView } from "@plateflow/shared"
import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/api-error"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import { advanceOrderStatus } from "../api"
import { isActiveStatus } from "../status"
import { activeOrdersKey } from "./use-live-orders"

interface AdvanceVariables {
  orderId: string
  status: OrderStatus
}

const applyStatus = (
  list: StaffOrderView[] | undefined,
  orderId: string,
  patch: StaffOrderView | OrderStatus
): StaffOrderView[] =>
  (list ?? [])
    .map((o) =>
      o.id === orderId
        ? typeof patch === "string"
          ? { ...o, status: patch }
          : patch
        : o
    )
    .filter((o) => isActiveStatus(o.status))

// Staff advancing (or cancelling) an order. Optimistic so the board moves the
// instant a button is tapped; the server's returned view then reconciles it, and
// a rejected transition (e.g. someone else already advanced it) re-syncs with a
// toast. The server also broadcasts the change, so other staff screens follow.
export function useAdvanceStatus() {
  const queryClient = useQueryClient()

  return useMutation<StaffOrderView, Error, AdvanceVariables>({
    mutationFn: ({ orderId, status }) => advanceOrderStatus(orderId, status),

    onMutate: async ({ orderId, status }) => {
      // Stop an in-flight fetch (the fallback poll, a reconnect refetch) from
      // overwriting the optimistic change before the mutation settles.
      await queryClient.cancelQueries({ queryKey: activeOrdersKey })
      queryClient.setQueryData<StaffOrderView[]>(activeOrdersKey, (list) =>
        applyStatus(list, orderId, status)
      )
    },

    onError: (error) => {
      // Re-sync from the server rather than restoring a snapshot. A snapshot
      // captured in onMutate can be stale — a socket update may have landed
      // mid-flight — and restoring it would clobber that. Refetching reconciles
      // to the truth (and reverts the failed optimistic change).
      void queryClient.invalidateQueries({ queryKey: activeOrdersKey })
      if (handleUnauthorized(error)) return
      toast.add({
        type: "error",
        title: "Couldn't update order",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },

    onSuccess: (order) => {
      queryClient.setQueryData<StaffOrderView[]>(activeOrdersKey, (list) =>
        applyStatus(list, order.id, order)
      )
    },
  })
}
