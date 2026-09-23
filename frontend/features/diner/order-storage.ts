"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

// Remembers which orders this phone has placed, per table token, so a diner who
// closes the status page (or reopens the menu) can get back to their orders. The
// order id is the capability that lets the phone read that order's status; it's
// stored here and nowhere on a server, since diners are anonymous.
//
// Orders belong to a dining session. After SESSION_TTL_MS we assume the diner
// has finished and left, so their ids are pruned — a customer who returns days
// later (same phone, same table QR) doesn't see last visit's orders. This only
// forgets the on-device pointer; the order still exists server-side.
//
// Shape in localStorage: { [token]: { id: string; at: number }[] } — oldest
// first, `at` = ms epoch the order was placed.
const STORAGE_KEY = "plateflow-orders"
const CHANGE_EVENT = "plateflow-orders-change"
const SESSION_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours — a long meal, gone by next day

interface Entry {
  id: string
  at: number
}
type Store = Record<string, Entry[]>

// useSyncExternalStore compares snapshots by identity, so the caches below hand
// back the SAME reference until the underlying raw string changes — otherwise it
// loops. We reparse (and remap to id-lists) only when localStorage actually
// changed.
let cachedRaw: string | null = null
let cachedStore: Store = {}
let cachedIds: Record<string, string[]> = {}
const EMPTY: string[] = []

// Tolerate a malformed or legacy (bare-string) entry: skip it rather than break.
function coerce(value: unknown): Entry[] {
  if (!Array.isArray(value)) return []
  const out: Entry[] = []
  for (const v of value) {
    if (
      v &&
      typeof v === "object" &&
      typeof (v as Entry).id === "string" &&
      typeof (v as Entry).at === "number"
    ) {
      out.push({ id: (v as Entry).id, at: (v as Entry).at })
    }
  }
  return out
}

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRaw) return cachedStore
    cachedRaw = raw
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    const store: Store = {}
    const ids: Record<string, string[]> = {}
    if (parsed && typeof parsed === "object") {
      for (const [token, val] of Object.entries(parsed)) {
        const entries = coerce(val)
        store[token] = entries
        ids[token] = entries.map((e) => e.id)
      }
    }
    cachedStore = store
    cachedIds = ids
  } catch {
    // A malformed or unreadable store shouldn't break the page; treat as empty.
    cachedStore = {}
    cachedIds = {}
  }
  return cachedStore
}

function write(store: Store): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  // "storage" only fires in other tabs; this repaints the current one too.
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// Drop orders older than the session window, across every table. Called once on
// mount so a returning diner's stale list clears itself even without a new order.
function pruneExpired(): void {
  const store = readStore()
  const now = Date.now()
  let changed = false
  const next: Store = {}
  for (const [token, entries] of Object.entries(store)) {
    const kept = entries.filter((e) => now - e.at < SESSION_TTL_MS)
    if (kept.length !== entries.length) changed = true
    if (kept.length > 0) next[token] = kept
  }
  if (changed) write(next)
}

export function rememberOrder(token: string, orderId: string): void {
  const store = readStore()
  const existing = store[token] ?? []
  if (existing.some((e) => e.id === orderId)) return
  write({ ...store, [token]: [...existing, { id: orderId, at: Date.now() }] })
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

// Every non-expired order id this phone placed for a table, oldest first (as
// stored). Reactive so the menu updates the moment one is placed. SSR snapshot is
// a stable empty array (localStorage is client-only) — no hydration mismatch.
export function useOrderIds(token: string): string[] {
  // Clear last-visit orders on mount; the write repaints via useSyncExternalStore.
  useEffect(() => {
    pruneExpired()
  }, [])

  const getSnapshot = useCallback(() => {
    readStore()
    return cachedIds[token] ?? EMPTY
  }, [token])

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
}
