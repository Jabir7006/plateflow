import Link from "next/link"
import { ArrowRight, Check, SlidersHorizontal } from "lucide-react"
import { LOGIN_PATH } from "../content"

const CAPABILITIES = [
  "Edit categories, dishes, photos and prices",
  "Update availability when a dish sells out",
  "Generate a QR code for every table",
  "Invite staff with the right role and access",
]

export function StaffSection() {
  return (
    <section
      id="staff"
      className="landing-section"
      aria-labelledby="staff-title"
    >
      <div className="landing-container landing-staff-grid">
        <div>
          <p className="landing-label">For the people behind the service</p>
          <h2 id="staff-title" className="landing-heading">
            You run the floor
            <br />
            We keep the details
            <br />
            in order
          </h2>
          <p className="landing-copy">
            One workspace for your menu and your team. Owners and managers stay
            in control, with access shaped around each person’s role.
          </p>
          <div className="landing-staff-actions">
            <Link href={LOGIN_PATH} className="landing-text-link">
              Go to staff login <ArrowRight />
            </Link>
          </div>
        </div>
        <div className="landing-staff-panel">
          <div className="landing-staff-panel-header">
            <SlidersHorizontal />
            <p>Your day-to-day, in one place</p>
          </div>
          <ul className="landing-staff-list">
            {CAPABILITIES.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
