"use client"

// One IntersectionObserver shared by every Reveal on the page, rather than one
// per element. A node registers a callback that fires once when it scrolls into
// view, then it's unobserved. Created lazily so nothing touches the browser API
// during SSR.
type RevealCallback = () => void

let observer: IntersectionObserver | null = null
const callbacks = new WeakMap<Element, RevealCallback>()

function getObserver(): IntersectionObserver {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const run = callbacks.get(entry.target)
        if (!run) continue
        callbacks.delete(entry.target)
        observer!.unobserve(entry.target)
        run()
      }
    },
    { rootMargin: "0px 0px -10% 0px" }
  )
  return observer
}

// Watch a node once; returns a cleanup that stops watching it (for the case it
// unmounts before ever intersecting).
export function observeReveal(
  node: Element,
  onReveal: RevealCallback
): () => void {
  const obs = getObserver()
  callbacks.set(node, onReveal)
  obs.observe(node)
  return () => {
    callbacks.delete(node)
    obs.unobserve(node)
  }
}
