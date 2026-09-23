"use client"

import { useCallback, useSyncExternalStore } from "react"

// A short, pleasant two-note chime played when a diner's order status changes,
// so someone mid-conversation still notices. Uses the Web Audio API (no asset to
// ship, no <audio> element to manage) with a single reused AudioContext.
//
// Browsers block audio until the page has had a user gesture. The diner reached
// this page by tapping ("Place order" or "View your order"), which counts, and
// we resume the context on that gesture via primeChime(); a status change that
// arrives later can then play. If the context is still suspended (e.g. a hard
// reload with no tap), the chime is silently skipped — the visual pulse still
// fires.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

// Call from a user gesture (a tap) so the context is running when a later,
// gesture-less status update wants to play.
export function primeChime(): void {
  const audio = getCtx()
  if (audio && audio.state === "suspended") void audio.resume()
}

export function playChime(): void {
  const audio = getCtx()
  if (!audio || audio.state !== "running") return

  const now = audio.currentTime
  const notes = [660, 880] // two rising notes
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    const start = now + i * 0.16
    // Quick attack, gentle decay so it reads as a chime, not a beep.
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.34)
  })
}

// Whether the diner has muted status chimes, remembered on this phone. Uses
// useSyncExternalStore so the SSR snapshot is a constant (unmuted) with no
// hydration mismatch, matching how the menu theme is read.
const MUTE_KEY = "plateflow-order-muted"
const MUTE_EVENT = "plateflow-mute-change"

function subscribeMuted(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(MUTE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(MUTE_EVENT, onChange)
  }
}

function readMuted(): boolean {
  return window.localStorage.getItem(MUTE_KEY) === "1"
}

export function useChimeMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(subscribeMuted, readMuted, () => false)

  const toggle = useCallback(() => {
    // Toggling is a gesture — a good moment to unlock audio for later chimes.
    primeChime()
    const next = !readMuted()
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0")
    window.dispatchEvent(new Event(MUTE_EVENT))
  }, [])

  return [muted, toggle]
}
