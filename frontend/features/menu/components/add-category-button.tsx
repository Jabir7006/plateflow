"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CategoryFormDialog } from "./category-form-dialog"

/**
 * The trigger and its create dialog are kept together so the open state never
 * leaves this boundary; the dialog itself stays controlled and reusable.
 */
export function AddCategoryButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add category
      </Button>

      <CategoryFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
