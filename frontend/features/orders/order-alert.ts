"use client"

import { useCallback, useSyncExternalStore } from "react"

// The staff board's new-order alert: a short three-note motif, a touch more
// insistent than the diner's two-note chime, so a new ticket is noticed across a
// busy kitchen. Same Web Audio approach as features/diner/order-chime.ts (no
// asset to ship, one reused AudioContext), kept separate because staff mute is
// its own preference and the sound differs.
//
// Browsers block audio until a user gesture; the board primes the context on the
// staffer's first interaction. Until then a new-order alert is silently skipped
// — the visual highlight on the board still fires.

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

// Call from a user gesture so the context is running when a later, gesture-less
// new-order alert wants to play.
export function primeAlert(): void {
  const audio = getCtx()
  if (audio && audio.state === "suspended") void audio.resume()
}

export function playNewOrderAlert(): void {
  const audio = getCtx()
  if (!audio || audio.state !== "running") return

  const now = audio.currentTime
  const notes = [523.25, 659.25, 783.99] // C5–E5–G5, a bright rising triad
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    const start = now + i * 0.12
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.28)
  })
}

// Whether staff have muted the new-order alert, remembered on this device. Uses
// useSyncExternalStore so the SSR snapshot is a constant (unmuted) with no
// hydration mismatch.
const MUTE_KEY = "plateflow-staff-order-muted"
const MUTE_EVENT = "plateflow-staff-mute-change"

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

export function useAlertMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(subscribeMuted, readMuted, () => false)

  const toggle = useCallback(() => {
    // Toggling is a gesture — a good moment to unlock audio for later alerts.
    primeAlert()
    const next = !readMuted()
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0")
    window.dispatchEvent(new Event(MUTE_EVENT))
  }, [])

  return [muted, toggle]
}
