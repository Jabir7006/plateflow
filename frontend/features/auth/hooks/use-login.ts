"use client"

import { useMutation } from "@tanstack/react-query"
import type { AuthUser } from "@plateflow/shared"
import { loginUser } from "../api"
import type { LoginInput } from "../api"
import { useSetSession } from "./use-set-session"

export function useLogin() {
  const setSession = useSetSession()

  return useMutation<AuthUser, Error, LoginInput>({
    mutationFn: loginUser,
    onSuccess: setSession,
  })
}

export type { LoginInput }
