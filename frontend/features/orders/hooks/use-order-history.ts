"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { hasCustomReportingDates } from "@plateflow/shared"
import { getOrderHistory, type OrderHistoryParams } from "../api"

// Keyed by the full param set so each filter/page combination caches on its own.
export const orderHistoryKey = (params: OrderHistoryParams) =>
  ["orders", "history", params] as const

export function useOrderHistory(params: OrderHistoryParams, enabled = true) {
  return useQuery({
    queryKey: orderHistoryKey(params),
    queryFn: () => getOrderHistory(params),
    // Lets the view hold off on a reversed custom range rather than firing a
    // request the backend would 400.
    enabled: enabled && hasCustomReportingDates(params),
    // Relative ranges must move to the next restaurant day while a tab stays
    // open; their query key deliberately contains the preset, not a browser day.
    refetchInterval:
      params.preset && params.preset !== "all" && params.preset !== "custom"
        ? 30_000
        : false,
    refetchOnWindowFocus: true,
    // Hold the previous page's rows while the next loads, so paging and filtering
    // don't flash an empty table.
    placeholderData: keepPreviousData,
  })
}
