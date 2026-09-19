"use client"

import { useQuery } from "@tanstack/react-query"
import { listTables } from "../api"

// The single tables list. Mutations invalidate exactly this key.
export const tablesKey = ["tables"] as const

export function useTables() {
  return useQuery({ queryKey: tablesKey, queryFn: listTables })
}
