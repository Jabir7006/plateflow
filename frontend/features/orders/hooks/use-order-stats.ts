"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getOrderStats } from "../api"
import type { DateRange } from "../date-range"

export const orderStatsKey = (range: DateRange) =>
  ["orders", "stats", range] as const

// The role gate is the conditional mount in OrderHistoryView — SalesSummary only
// renders for OWNER/MANAGER, so this query never runs for anyone else. (The
// backend 403s them regardless; the mount just avoids the pointless request.)
export function useOrderStats(range: DateRange) {
  return useQuery({
    queryKey: orderStatsKey(range),
    queryFn: () => getOrderStats(range),
    // Hold the previous range's tiles while the next loads, so changing the range
    // moves the tiles in step with the keepPreviousData table instead of flashing
    // skeletons under it.
    placeholderData: keepPreviousData,
  })
}
