"use client"

import { useCallback, useSyncExternalStore } from "react"

export type MenuTheme = "dark" | "light"

const STORAGE_KEY = "plateflow-menu-theme"

// Same-tab writes fire a custom event ("storage" only crosses tabs); we also
// track the OS colour-scheme so a diner who never picks a theme follows their
// phone's setting.
function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: light)")
  window.addEventListener("storage", onChange)
  window.addEventListener("plateflow-theme-change", onChange)
  media.addEventListener("change", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("plateflow-theme-change", onChange)
    media.removeEventListener("change", onChange)
  }
}

// Stored choice wins; otherwise follow the OS. A diner who taps the toggle pins
// their preference for this phone; one who never does gets their system theme.
function readStored(): MenuTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === "dark" || stored === "light") return stored
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark"
}

// Remembers the diner's preferred menu theme on their own phone. Defaults to the
// system colour scheme (many diners will want light in daylight). Uses
// useSyncExternalStore so the SSR/first-paint snapshot is a fixed default (no
// hydration mismatch); the real value resolves on the client.
export function useMenuTheme(): [MenuTheme, (theme: MenuTheme) => void] {
  // Server snapshot must be constant → "dark" (the base .menu-page theme). The
  // client reconciles to the stored/system value right after hydration.
  const theme = useSyncExternalStore(
    subscribe,
    readStored,
    (): MenuTheme => "dark"
  )

  const setTheme = useCallback((next: MenuTheme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event("plateflow-theme-change"))
  }, [])

  return [theme, setTheme]
}
