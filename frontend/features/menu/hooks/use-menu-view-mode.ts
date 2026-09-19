"use client"

import { useSyncExternalStore } from "react"
import { menuViewMode, type MenuViewMode } from "../view-mode"

export function useMenuViewMode(): {
  mode: MenuViewMode
  setMode: (mode: MenuViewMode) => void
} {
  const mode = useSyncExternalStore(
    menuViewMode.subscribe,
    menuViewMode.getMode,
    menuViewMode.getServerMode
  )
  return { mode, setMode: menuViewMode.setMode }
}
