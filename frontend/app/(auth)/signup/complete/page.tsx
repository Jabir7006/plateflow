import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SignupCompleteForm } from "@/features/auth/components/signup-complete-form"
import { isSelfServeSignupEnabled } from "@/features/auth/signup-flag"

export const metadata: Metadata = {
  title: "Finish your restaurant setup — PlateFlow",
}

export default function SignupCompletePage() {
  if (!isSelfServeSignupEnabled) notFound()

  // The token arrives in the URL fragment, which the server never receives, so
  // the client form reads and immediately removes it on mount.
  return <SignupCompleteForm />
}
