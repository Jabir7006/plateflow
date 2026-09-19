"use client"

import { useCanManageMenu } from "../hooks/use-can-manage-menu"
import { ManageCategoriesButton } from "./manage-categories-button"

// The interactive island for the page header. Only users who may manage the
// menu get the controls; everyone else reads the menu with no actions. Isolated
// so the page and header stay server components.
export function MenuActions() {
  const canManage = useCanManageMenu()

  if (!canManage) return null

  return <ManageCategoriesButton />
}
