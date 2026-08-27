"use client"

import { useMutation } from "@tanstack/react-query"
import type { AuthUser } from "@plateflow/shared"
import { useAuthStore } from "../store/auth-store"
import { loginUser } from "../api"
import type { LoginInput } from "../api"

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation<AuthUser, Error, LoginInput>({
    mutationFn: loginUser,
    onSuccess: (user) => setUser(user),
  })
}

export type { LoginInput }
