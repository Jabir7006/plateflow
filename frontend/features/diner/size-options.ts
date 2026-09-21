// Which categories show the S/M/L size selector. Visual only for now: the data
// model has one price per item, so a size doesn't change the price yet — this is
// the placeholder for a real per-size pricing feature later. Matched on the
// lowercased category name so "Burgers"/"burger" both hit.
const SIZED_CATEGORY_KEYWORDS = ["burger", "pizza"]

export const SIZE_OPTIONS = ["S", "M", "L"] as const
export type SizeOption = (typeof SIZE_OPTIONS)[number]

// The middle option is the sensible pre-selection
export const DEFAULT_SIZE: SizeOption = "M"

export function categoryHasSizes(categoryName: string): boolean {
  const name = categoryName.toLowerCase()
  return SIZED_CATEGORY_KEYWORDS.some((keyword) => name.includes(keyword))
}
