"use client"

import { useCallback, useMemo, useState } from "react"
import type { MenuItem, MenuItemSize } from "@plateflow/shared"

export interface CartLine {
  key: string
  item: MenuItem
  size: MenuItemSize | null
  quantity: number
  // What one of this line costs: the size's price when sized, else the item's.
  unitPrice: number
}

export interface Cart {
  lines: CartLine[]
  itemCount: number
  total: number
  quantityOf: (itemId: string, sizeId?: string | null) => number
  add: (item: MenuItem, size?: MenuItemSize | null) => void
  remove: (itemId: string, sizeId?: string | null) => void
  clear: () => void
}

interface StoredLine {
  item: MenuItem
  size: MenuItemSize | null
  quantity: number
}

// A sized item's each size is its own line, so the key is item + size. An
// unsized item uses an empty size segment.
const lineKey = (itemId: string, sizeId?: string | null) =>
  `${itemId}::${sizeId ?? ""}`

const unitPrice = (item: MenuItem, size: MenuItemSize | null) =>
  size ? size.price : item.price

// A front-end-only cart shared by both menu views. Nothing is sent to the
// backend — placing a real order is a later feature — so this lives entirely in
// component state and resets on reload. Keyed by item + size; quantity 0 drops
// the line so itemCount and total stay honest.
export function useCart(): Cart {
  const [entries, setEntries] = useState<Record<string, StoredLine>>({})

  const add = useCallback((item: MenuItem, size: MenuItemSize | null = null) => {
    const key = lineKey(item.id, size?.id)
    setEntries((prev) => ({
      ...prev,
      [key]: {
        item,
        size,
        quantity: (prev[key]?.quantity ?? 0) + 1,
      },
    }))
  }, [])

  const remove = useCallback(
    (itemId: string, sizeId: string | null = null) => {
      const key = lineKey(itemId, sizeId)
      setEntries((prev) => {
        const current = prev[key]
        if (!current) return prev
        const rest = { ...prev }
        if (current.quantity <= 1) {
          delete rest[key]
          return rest
        }
        rest[key] = { ...current, quantity: current.quantity - 1 }
        return rest
      })
    },
    []
  )

  const clear = useCallback(() => setEntries({}), [])

  const quantityOf = useCallback(
    (itemId: string, sizeId?: string | null) =>
      entries[lineKey(itemId, sizeId)]?.quantity ?? 0,
    [entries]
  )

  const { lines, itemCount, total } = useMemo(() => {
    const lines: CartLine[] = []
    let itemCount = 0
    let total = 0
    for (const [key, { item, size, quantity }] of Object.entries(entries)) {
      if (quantity <= 0) continue
      const price = unitPrice(item, size)
      lines.push({ key, item, size, quantity, unitPrice: price })
      itemCount += quantity
      total += price * quantity
    }
    return { lines, itemCount, total }
  }, [entries])

  return { lines, itemCount, total, quantityOf, add, remove, clear }
}
