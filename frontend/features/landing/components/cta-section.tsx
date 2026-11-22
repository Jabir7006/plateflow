import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { DEMO_MENU_PATH } from "../content"

const CONTACT_HREF = "mailto:jabirahmad7005@gmail.com?subject=PlateFlow%20demo"

export function CtaSection() {
  return (
    <section className="landing-cta" aria-labelledby="cta-title">
      <div className="landing-container landing-cta-inner">
        <div>
          <h2 id="cta-title" className="landing-heading">
            Your next service,
            <br />a little simpler
          </h2>
          <p>
            Take a seat on the guest side. Try the menu, or get in touch to
            bring PlateFlow to your tables.
          </p>
        </div>
        <div className="landing-cta-actions">
          <a
            href={CONTACT_HREF}
            className="landing-button landing-button-primary"
          >
            Book a demo <ArrowRight />
          </a>
          <Link href={DEMO_MENU_PATH} className="landing-text-link">
            Explore the menu <ArrowRight />
          </Link>
        </div>
      </div>
    </section>
  )
}
