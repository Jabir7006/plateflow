"use client"

import { useCallback, useMemo, useState } from "react"
import type { MenuItem } from "@plateflow/shared"

export interface CartLine {
  item: MenuItem
  quantity: number
}

export interface Cart {
  lines: CartLine[]
  itemCount: number
  total: number
  quantityOf: (itemId: string) => number
  add: (item: MenuItem) => void
  remove: (itemId: string) => void
  clear: () => void
}

// A front-end-only cart shared by both menu views. Nothing is sent to the
// backend — placing a real order is a later feature — so this lives entirely in
// component state and resets on reload. Keyed by item id; quantity 0 drops the
// line so itemCount and total stay honest.
export function useCart(): Cart {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  // Items are held alongside quantities so lines can be rendered (name, price)
  // without threading the full menu back through every consumer.
  const [items, setItems] = useState<Record<string, MenuItem>>({})

  const add = useCallback((item: MenuItem) => {
    setItems((prev) => ({ ...prev, [item.id]: item }))
    setQuantities((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))
  }, [])

  const remove = useCallback((itemId: string) => {
    setQuantities((prev) => {
      const next = (prev[itemId] ?? 0) - 1
      const rest = { ...prev }
      delete rest[itemId]
      if (next <= 0) return rest
      return { ...rest, [itemId]: next }
    })
  }, [])

  const clear = useCallback(() => {
    setQuantities({})
    setItems({})
  }, [])

  const quantityOf = useCallback(
    (itemId: string) => quantities[itemId] ?? 0,
    [quantities]
  )

  const { lines, itemCount, total } = useMemo(() => {
    const lines: CartLine[] = []
    let itemCount = 0
    let total = 0
    for (const [id, quantity] of Object.entries(quantities)) {
      const item = items[id]
      if (!item || quantity <= 0) continue
      lines.push({ item, quantity })
      itemCount += quantity
      total += item.price * quantity
    }
    return { lines, itemCount, total }
  }, [quantities, items])

  return { lines, itemCount, total, quantityOf, add, remove, clear }
}
