import type { Metadata } from "next"

import { AcceptInviteForm } from "@/features/auth/components/accept-invite-form"

export const metadata: Metadata = {
  title: "Accept invitation — PlateFlow",
}

interface AcceptInvitePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AcceptInvitePage({
  searchParams,
}: AcceptInvitePageProps) {
  // The token is the credential here: read on the server so the client form
  // never has to touch useSearchParams
  const { token } = await searchParams

  return <AcceptInviteForm token={typeof token === "string" ? token : ""} />
}
