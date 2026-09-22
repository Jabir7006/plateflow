import Link from "next/link"
import { UtensilsCrossed } from "lucide-react"
import { LOGIN_PATH, NAV_LINKS } from "../content"

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <UtensilsCrossed className="size-3.5" />
          </span>
          <span className="font-display font-semibold">PlateFlow</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Link
            href={LOGIN_PATH}
            className="transition-colors hover:text-foreground"
          >
            Staff login
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} PlateFlow
        </p>
      </div>
    </footer>
  )
}
