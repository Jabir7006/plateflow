// "3 min ago" style relative time for past timestamps, used by the order status
// page and the menu's orders list. (format-duration.ts covers future deadlines.)
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  return `${hr} hr${hr === 1 ? "" : "s"} ago`
}
