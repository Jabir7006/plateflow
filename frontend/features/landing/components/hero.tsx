"use client"

import Link from "next/link"
import { ArrowRight, Check, Clock, Flame } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEMO_MENU_PATH } from "../content"
import { Reveal } from "./reveal"

const STATUSES = [
  { label: "Order placed", icon: Check, note: "Table 4 · 2 items" },
  { label: "Preparing", icon: Flame, note: "Chef started · 6 min" },
  { label: "Ready to pick up", icon: Check, note: "At the pass" },
] as const

// A mock of the diner's live order card, cycling through statuses so the hero
// shows the real-time loop in motion rather than describing it.
function LiveOrderCard() {
  const prefersReducedMotion = useReducedMotion()
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) return
    const id = setInterval(
      () => setActive((i) => (i + 1) % STATUSES.length),
      2200
    )
    return () => clearInterval(id)
  }, [prefersReducedMotion])

  return (
    <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Your order
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" />
          Live
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {STATUSES.map((status, i) => {
          const done = i <= active
          const Icon = i < active ? Check : status.icon
          return (
            <div key={status.label} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                  done
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {status.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {status.note}
                </p>
              </div>
              {i === active ? (
                <Clock className="size-4 shrink-0 text-brand" />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--color-brand)_12%,transparent),transparent)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            QR ordering + live kitchen
          </span>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            From the table to the kitchen, in real time
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground text-pretty">
            PlateFlow turns any table into a QR menu, sends orders straight to
            the kitchen, and lets diners watch their food move from placed to
            ready — live.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={DEMO_MENU_PATH}
              className={cn(buttonVariants(), "h-11 px-5")}
            >
              View a live menu
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#flow"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 px-5"
              )}
            >
              See how it works
            </a>
          </div>
        </div>

        <Reveal className="flex justify-center md:justify-end">
          <LiveOrderCard />
        </Reveal>
      </div>
    </section>
  )
}
