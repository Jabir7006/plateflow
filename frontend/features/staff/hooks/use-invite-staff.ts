"use client"

import { useMutation } from "@tanstack/react-query"
import { ROLE_LABELS } from "@plateflow/shared"
import { toast } from "@/components/ui/toast"
import { inviteStaff } from "../api"
import type { InviteInput, InvitedStaff } from "../api"

/**
 * Sends a staff invitation. Not retried automatically: the request emails a
 * one-time link, so a blind retry after a timeout could deliver a second live
 * invitation. Re-sending by hand is safe; the backend replaces a superseded
 * or expired invite for the same email.
 */
export function useInviteStaff() {
  return useMutation<InvitedStaff, Error, InviteInput>({
    mutationFn: inviteStaff,
    onSuccess: (invited, variables) => {
      toast.add({
        type: "success",
        title: "Invitation sent",
        description: `${invited.fullName} (${invited.email}) was invited as ${ROLE_LABELS[variables.role]}.`,
      })
    },
  })
}
