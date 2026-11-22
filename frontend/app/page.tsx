import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"

import "@/features/landing/landing.css"

import { LandingHeader } from "@/features/landing/components/landing-header"
import { Hero } from "@/features/landing/components/hero"
import { LiveLoop } from "@/features/landing/components/live-loop"
import { FeatureGrid } from "@/features/landing/components/feature-grid"
import { StaffSection } from "@/features/landing/components/staff-section"
import { CtaSection } from "@/features/landing/components/cta-section"
import { LandingFooter } from "@/features/landing/components/landing-footer"
import { PageMotion } from "@/features/landing/components/page-motion"

const landingFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-landing",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PlateFlow — A better menu for every table",
  description:
    "Give every table a photo-first QR menu. Manage your menu and team, send orders to the kitchen and keep guests updated in real time.",
}

export default function Page() {
  return (
    <div className={`landing-page ${landingFont.variable}`}>
      <PageMotion />
      <LandingHeader />
      <main id="main-content">
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
