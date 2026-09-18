"use client"

import { useQuery } from "@tanstack/react-query"
import type { InvitePreview } from "@plateflow/shared"
import { verifyInvite } from "../api"

// A rejected token is an answer, not a network blip: retrying would only
// re-ask a question the server already settled.
export function useVerifyInvite(token: string) {
  return useQuery<InvitePreview, Error>({
    queryKey: ["invite-preview", token],
    queryFn: () => verifyInvite(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: 0,
  })
}
