// Matches the currency symbol the dashboard already uses. Grouped thousands,
// and decimals only when the price actually has them, so "₮250" and "₮1,250.50"
// both read cleanly.
const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatPrice(value: number): string {
  return `৳${priceFormatter.format(value)}`
}
