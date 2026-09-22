import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEMO_MENU_PATH } from "../content"

const CONTACT_HREF = "mailto:jabirahmad7005@gmail.com?subject=PlateFlow%20demo"

export function CtaSection() {
  return (
    <section className="px-4 py-20 sm:px-6 md:py-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center sm:px-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_0%,color-mix(in_oklch,var(--color-brand)_14%,transparent),transparent)]" />
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Bring your restaurant online this week
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
          See the diner experience for yourself, or get in touch to set
          PlateFlow up for your tables.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={CONTACT_HREF} className={cn(buttonVariants(), "h-11 px-5")}>
            Book a demo
            <ArrowRight className="size-4" />
          </a>
          <Link
            href={DEMO_MENU_PATH}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}
          >
            View a live menu
          </Link>
        </div>
      </div>
    </section>
  )
}
