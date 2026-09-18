"use client"

import { useMutation } from "@tanstack/react-query"
import type { AuthUser } from "@plateflow/shared"
import { toast } from "@/components/ui/toast"
import { useAuthStore } from "../store/auth-store"
import { acceptInvite } from "../api"
import type { AcceptInviteInput } from "../api"

// The backend sets the session cookies on acceptance, so the store only needs
// the returned user for the redirect to land on an authenticated dashboard.
export function useAcceptInvite() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation<AuthUser, Error, AcceptInviteInput>({
    mutationFn: acceptInvite,
    onSuccess: (user) => {
      setUser(user)
      toast.add({
        type: "success",
        title: "Account activated",
        description: `Welcome to PlateFlow, ${user.fullName}.`,
      })
    },
  })
}
