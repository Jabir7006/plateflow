"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TableFormDialog } from "./table-form-dialog"

/**
 * Primary "Add table" action and its create dialog, kept together so the open
 * state never leaves this boundary; the dialog itself stays controlled.
 */
export function AddTableButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add table
      </Button>

      <TableFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
