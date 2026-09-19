// The URL a table's QR code encodes. Uses the serving origin so the same build
// works on any domain with no config. The public `/t/<token>` order page is a
// later feature; keeping the shape here means it and the QR stay in agreement.
//
// Client-only: reads `window`, so call it from a client island (the QR dialog).
export function tableOrderUrl(token: string): string {
  return `${window.location.origin}/t/${token}`
}
