import type { MenuItem } from "./api"

export interface MenuItemGroup {
  categoryId: string
  categoryName: string
  items: MenuItem[]
}

// Groups items under their category, preserving the order the API returned
// (already sorted by category then name), so the menu renders top to bottom the
// way it was sorted. A single pass keyed by category id, no per-item scan.
export function groupByCategory(items: MenuItem[]): MenuItemGroup[] {
  const groups: MenuItemGroup[] = []
  const indexById = new Map<string, number>()

  for (const item of items) {
    let index = indexById.get(item.categoryId)

    if (index === undefined) {
      index = groups.length
      indexById.set(item.categoryId, index)
      groups.push({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        items: [],
      })
    }

    groups[index].items.push(item)
  }

  return groups
}
