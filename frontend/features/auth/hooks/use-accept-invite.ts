"use client"

import { useMutation } from "@tanstack/react-query"
import type { AuthUser } from "@plateflow/shared"
import { toast } from "@/components/ui/toast"
import { acceptInvite } from "../api"
import type { AcceptInviteInput } from "../api"
import { useSetSession } from "./use-set-session"

// The backend sets the session cookies on acceptance, so the store only needs
// the returned user for the redirect to land on an authenticated dashboard.
export function useAcceptInvite() {
  const setSession = useSetSession()

  return useMutation<AuthUser, Error, AcceptInviteInput>({
    mutationFn: acceptInvite,
    onSuccess: (user) => {
      setSession(user)
      toast.add({
        type: "success",
        title: "Account activated",
        description: `Welcome to PlateFlow, ${user.fullName}.`,
      })
    },
  })
}
