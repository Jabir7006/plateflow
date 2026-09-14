"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { logoutUser } from "../api"
import { useAuthStore } from "../store/auth-store"

export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const reset = useAuthStore((state) => state.reset)

  return useMutation({
    mutationFn: logoutUser,
    // Absorb a transient blip before giving up on reaching the server.
    retry: 1,
    // The user asked to be signed out, so local identity and cached staff data go
    // either way. The backend surrenders its cookies on every logout it receives,
    // so a failed revocation cannot leave this browser able to resume the session.
    onSettled: () => {
      queryClient.clear()
      reset()
      router.replace("/login")
      router.refresh()
    },
  })
}
