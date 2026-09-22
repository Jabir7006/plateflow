import type { Metadata } from "next"

import { LandingHeader } from "@/features/landing/components/landing-header"
import { Hero } from "@/features/landing/components/hero"
import { LiveLoop } from "@/features/landing/components/live-loop"
import { FeatureGrid } from "@/features/landing/components/feature-grid"
import { StaffSection } from "@/features/landing/components/staff-section"
import { CtaSection } from "@/features/landing/components/cta-section"
import { LandingFooter } from "@/features/landing/components/landing-footer"

export const metadata: Metadata = {
  title: "PlateFlow — QR ordering and live kitchen for restaurants",
  description:
    "Turn every table into a QR menu, send orders straight to the kitchen, and let diners track their food from placed to ready in real time.",
}

export default function Page() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <LandingHeader />
      <main>
        <Hero />
        <LiveLoop />
        <FeatureGrid />
        <StaffSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
