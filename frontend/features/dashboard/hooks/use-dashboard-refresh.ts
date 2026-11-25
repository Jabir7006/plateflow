"use client"

import { useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createRefreshThrottle } from "@plateflow/shared"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { dashboardSummaryKey } from "./use-dashboard-summary"

export function useDashboardRefresh() {
  const queryClient = useQueryClient()
  const restaurantId = useAuthStore((state) => state.user?.restaurant.id)
  const refresh = useMemo(
    () =>
      createRefreshThrottle(() => {
        void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey })
      }),
    [queryClient]
  )

  // Reset the window and cancel pending work whenever the identity changes.
  useEffect(() => () => refresh.cancel(), [refresh, restaurantId])
  return refresh
}
