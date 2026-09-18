// Sidebar collapse state, persisted in localStorage and exposed as an
// external store so useSyncExternalStore can read it without hydration
// mismatches (the server snapshot is always expanded) and without
// setState-in-effect. Cross-tab sync falls out of the storage event.

const STORAGE_KEY = "plateflow:sidebar-collapsed"
const CHANGE_EVENT = "plateflow:sidebar-collapsed-change"

function isCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    // Storage can be unavailable (privacy modes); default to expanded.
    return false
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

function toggle(): void {
  const next = !isCollapsed()
  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, "1")
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // The state still flips for this session even when persistence fails.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export const sidebarState = {
  subscribe,
  isCollapsed,
  getServerCollapsed: (): boolean => false,
  toggle,
}
