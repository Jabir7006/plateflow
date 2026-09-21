"use client"

import { useCallback, useSyncExternalStore } from "react"

export type ViewMode = "immersive" | "simple"

const STORAGE_KEY = "plateflow-menu-view"
const DEFAULT_MODE: ViewMode = "immersive"

function readStored(): ViewMode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "immersive" || stored === "simple" ? stored : DEFAULT_MODE
}

// Same-tab writes fire a custom event ("storage" only crosses tabs); listeners
// get both so any consumer re-reads on change.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener("plateflow-view-change", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("plateflow-view-change", onChange)
  }
}

// Remembers the diner's preferred menu view on their own phone. Uses
// useSyncExternalStore so the SSR/first-paint snapshot is the default (no
// hydration mismatch) and the stored choice is picked up on the client without
// a setState-in-effect. The choice persists across scans on the same phone.
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(subscribe, readStored, () => DEFAULT_MODE)

  const setMode = useCallback((next: ViewMode) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event("plateflow-view-change"))
  }, [])

  return [mode, setMode]
}
