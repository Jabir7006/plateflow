"use client"

import { useCanManageTables } from "../hooks/use-can-manage-tables"
import { AddTableButton } from "./add-table-button"

// The interactive island for the page header. Only users who may manage tables
// see the action; everyone else gets a plain header.
export function TablesHeaderActions() {
  const canManage = useCanManageTables()

  if (!canManage) return null

  return <AddTableButton />
}
