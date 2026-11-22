"use client"

import { useEffect } from "react"

// Content stays visible before hydration and with JavaScript disabled. Observe
// five groups once; CSS handles each entrance without scroll-time React work.
export function PageMotion() {
  useEffect(() => {
    const root = document.querySelector(".landing-page")
    if (!root || !("IntersectionObserver" in window)) return

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const targets = root.querySelectorAll(
      ".landing-hero-grid, .landing-section-heading, .landing-staff-grid > div:first-child, .landing-cta-inner"
    )
    const shown = new Set<Element>()
    let cancelled = false
    let fontsReady = false

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || preference.matches) continue
          entry.target.classList.add("landing-entered")
          shown.add(entry.target)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1 }
    )

    function syncPreference() {
      observer.disconnect()
      if (preference.matches) {
        targets.forEach((target) => target.classList.remove("landing-entered"))
        return
      }
      if (!fontsReady) return
      targets.forEach((target) => {
        if (!shown.has(target)) observer.observe(target)
      })
    }

    // Wait for the real type to be painted before starting the entrance;
    // this does not delay displaying or interacting with the page.
    void document.fonts.ready.then(() => {
      if (cancelled) return
      fontsReady = true
      syncPreference()
    })
    preference.addEventListener("change", syncPreference)

    return () => {
      cancelled = true
      observer.disconnect()
      preference.removeEventListener("change", syncPreference)
    }
  }, [])

  return null
}
