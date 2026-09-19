// A count with its noun, pluralised: "No items", "1 item", "3 items". The
// plural defaults to singular + "s"; pass it explicitly for irregulars
// ("person" / "people"). Shared across features so every list phrases counts
// the same way.
export function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  if (count === 0) return `No ${plural}`
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}
