// How the menu items list is laid out, persisted in localStorage and exposed as
// an external store so useSyncExternalStore can read it without a hydration
// mismatch (the server snapshot is always the default) and without
// setState-in-effect. Cross-tab sync falls out of the storage event.

export type MenuViewMode = "list" | "grid"

const STORAGE_KEY = "plateflow:menu-view-mode"
const CHANGE_EVENT = "plateflow:menu-view-mode-change"
const DEFAULT_MODE: MenuViewMode = "list"

function getMode(): MenuViewMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "grid" ? "grid" : "list"
  } catch {
    // Storage can be unavailable (privacy modes); fall back to the default.
    return DEFAULT_MODE
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function setMode(mode: MenuViewMode): void {
  try {
    // Only the non-default is stored, so clearing storage returns to the
    // default rather than to whichever value was written last.
    if (mode === "grid") {
      localStorage.setItem(STORAGE_KEY, "grid")
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // The choice still applies for this session even when persistence fails.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export const menuViewMode = {
  subscribe,
  getMode,
  getServerMode: (): MenuViewMode => DEFAULT_MODE,
  setMode,
}
