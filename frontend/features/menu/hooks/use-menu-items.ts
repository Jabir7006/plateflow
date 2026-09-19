"use client"

import { useQuery } from "@tanstack/react-query"
import { listMenuItems } from "../api"

// Keyed by category so a filtered view and the full list cache independently.
export const menuItemsKey = (categoryId?: string) =>
  ["menu", "items", categoryId ?? "all"] as const

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: menuItemsKey(categoryId),
    queryFn: () => listMenuItems(categoryId),
  })
}
