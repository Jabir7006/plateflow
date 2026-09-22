"use client"

import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { observeReveal } from "./reveal-observer"

interface RevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
  // Render as something other than a <div> (e.g. "li" inside an <ol>) so list
  // semantics stay intact.
  as?: "div" | "li"
}

// A scroll-in reveal that survives SSR: the hidden state is expressed with the
// same classes on server and client (no JS-set inline styles), so hydration
// matches; a shared IntersectionObserver flips it on after mount. Reduced-motion
// users always see the content. With JS off, the <noscript> style in
// app/layout.tsx forces `.reveal` visible so no-JS visitors don't get a blank
// page.
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: RevealProps) {
  const [shown, setShown] = useState(false)

  // Callback ref: registers with the shared observer when the node mounts and
  // cleans up when it unmounts. Typed as the base element so neither <div> nor
  // <li> needs a cast.
  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return
    return observeReveal(node, () => setShown(true))
  }, [])

  return (
    <Tag
      ref={ref}
      // The stagger only offsets the entrance; once shown, drop the delay so it
      // never lingers on later transitions (e.g. hover, theme change).
      style={shown ? undefined : { transitionDelay: `${delay}ms` }}
      className={cn(
        "reveal transition-all duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className
      )}
    >
      {children}
    </Tag>
  )
}
