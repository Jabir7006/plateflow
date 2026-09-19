"use client"

import { useQuery } from "@tanstack/react-query"
import { listMenuCategories } from "../api"

// Shared so the mutations can invalidate exactly this list.
export const menuCategoriesKey = ["menu", "categories"] as const

export function useMenuCategories() {
  return useQuery({
    queryKey: menuCategoriesKey,
    queryFn: listMenuCategories,
  })
}
