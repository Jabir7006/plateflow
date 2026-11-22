"use client"

import Link from "next/link"
import { Menu, UtensilsCrossed, X } from "lucide-react"
import { useState } from "react"
import { LOGIN_PATH, NAV_LINKS } from "../content"
import { ThemeToggle } from "./theme-toggle"

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      className="landing-header"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !menuOpen) return
        setMenuOpen(false)
        event.currentTarget
          .querySelector<HTMLButtonElement>(".landing-menu-toggle")
          ?.focus()
      }}
    >
      <a href="#main-content" className="landing-skip-link">
        Skip to content
      </a>
      <div className="landing-container landing-header-inner">
        <Link href="/" className="landing-wordmark" aria-label="PlateFlow home">
          <span className="landing-logo-mark">
            <UtensilsCrossed />
          </span>
          <span>PlateFlow</span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="landing-header-actions">
          <ThemeToggle />
          <Link
            href={LOGIN_PATH}
            className="landing-text-link landing-header-login"
          >
            Staff login <span aria-hidden="true">↗</span>
          </Link>
          <button
            type="button"
            className="landing-menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X size={18} strokeWidth={1.5} />
            ) : (
              <Menu size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav
          id="landing-mobile-navigation"
          className="landing-mobile-nav"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link href={LOGIN_PATH} onClick={() => setMenuOpen(false)}>
            Staff login
          </Link>
        </nav>
      ) : null}
    </header>
  )
}
