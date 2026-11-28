import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SignupRequestForm } from "@/features/auth/components/signup-request-form"
import { isSelfServeSignupEnabled } from "@/features/auth/signup-flag"

export const metadata: Metadata = {
  title: "Create your restaurant — PlateFlow",
}

export default function SignupPage() {
  // The flag is a build-time constant, so a deployment without onboarding gets
  // a normal 404 rather than a page whose submit button would always fail.
  if (!isSelfServeSignupEnabled) notFound()

  return <SignupRequestForm />
}
