import Link from "next/link"
import { ArrowRight, QrCode, SlidersHorizontal, Users } from "lucide-react"
import { DEMO_MENU_PATH } from "../content"
import { MenuPreview } from "./menu-preview"

export function Hero() {
  return (
    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="landing-container">
        <div className="landing-hero-grid">
          <div>
            <p className="landing-label">QR menus for thoughtful service</p>
            <h1 id="hero-title">
              Good service
              <br />
              starts at
              <br />
              <span>the table</span>
            </h1>
            <p className="landing-hero-description">
              A menu worth browsing. A team ready to serve. Give every table a
              QR menu, and manage the details from one place.
            </p>
            <div className="landing-hero-actions">
              <Link
                href={DEMO_MENU_PATH}
                className="landing-button landing-button-primary"
              >
                View a live menu <ArrowRight />
              </Link>
              <a href="#flow" className="landing-text-link">
                See how it works <ArrowRight />
              </a>
            </div>
            <p className="landing-hero-note">
              On your guest’s phone, in your team’s hands
            </p>
          </div>
          <MenuPreview />
        </div>
        <div
          className="landing-service-line"
          aria-label="PlateFlow capabilities"
        >
          <span>
            <QrCode /> A menu for every table
          </span>
          <span>
            <SlidersHorizontal /> Your menu, easy to manage
          </span>
          <span>
            <Users /> The right access for every role
          </span>
        </div>
      </div>
    </section>
  )
}
