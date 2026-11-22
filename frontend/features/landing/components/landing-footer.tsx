import Link from "next/link"
import { UtensilsCrossed } from "lucide-react"
import { LOGIN_PATH, NAV_LINKS } from "../content"

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <Link href="/" className="landing-wordmark" aria-label="PlateFlow home">
          <span className="landing-logo-mark">
            <UtensilsCrossed />
          </span>
          <span>PlateFlow</span>
        </Link>
        <nav aria-label="Footer navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Link href={LOGIN_PATH}>Staff login</Link>
        </nav>
        <small>© {new Date().getFullYear()} PlateFlow</small>
      </div>
    </footer>
  )
}
