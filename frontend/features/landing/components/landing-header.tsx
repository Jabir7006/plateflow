import Link from "next/link"
import { UtensilsCrossed } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LOGIN_PATH, NAV_LINKS } from "../content"
import { ThemeToggle } from "./theme-toggle"

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <UtensilsCrossed className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            PlateFlow
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={LOGIN_PATH}
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            Staff login
          </Link>
        </div>
      </div>
    </header>
  )
}
