import Link from "next/link"
import { Check } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LOGIN_PATH } from "../content"

const CAPABILITIES = [
  "Edit categories, dishes, photos and prices",
  "Flip availability the moment you sell out",
  "Generate a QR for every table",
  "Invite staff with the right role and access",
]

export function StaffSection() {
  return (
    <section id="staff" className="border-t border-border/60 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the people running the floor
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">
            Owners and managers get one dashboard for the whole menu and team.
            Chefs get a screen that only shows what&apos;s cooking.
          </p>
          <Link
            href={LOGIN_PATH}
            className={cn(buttonVariants(), "mt-8 h-11 px-5")}
          >
            Staff login
          </Link>
        </div>

        <ul className="space-y-3">
          {CAPABILITIES.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Check className="size-3.5" />
              </span>
              <span className="text-sm text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
