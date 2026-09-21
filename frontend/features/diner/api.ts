import type { TableMenu } from "@plateflow/shared"

export type { TableMenu }

// The diner page renders on the server, so it talks to the backend directly
// rather than through the browser's /api/v1 proxy (that path and its session
// cookie only exist in the browser). BACKEND_URL is the same var next.config
// uses for the rewrite; it falls back to the dev backend.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000"

interface Envelope<T> {
  success: boolean
  message: string
  data: T
}

// Resolves a scanned QR token to its table + available menu. Returns null when
// the token is unknown (a 404 — a garbage or regenerated/dead code) so the page
// can show a friendly "invalid code" state; throws on real failures so they
// surface rather than masquerading as an empty menu.
export async function getTableMenu(token: string): Promise<TableMenu | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/t/${encodeURIComponent(token)}`,
    // The menu changes rarely; cache briefly. Each token is its own URL, and
    // the backend re-checks token validity whenever this revalidates, so a
    // regenerated code still stops working within the window.
    { next: { revalidate: 60 } }
  )

  if (res.status === 404) return null

  if (!res.ok) {
    throw new Error(`Failed to load menu (${res.status})`)
  }

  const body = (await res.json()) as Envelope<TableMenu>
  return body.data
}
