"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMenuCategories } from "../hooks/use-menu-categories"
import { ItemFormDialog } from "./item-form-dialog"

/**
 * Primary "Add item" action and its create dialog. An item needs a category, so
 * the button is disabled until at least one exists; the tooltip points the user
 * at "Manage categories" to make one.
 */
export function AddItemButton() {
  const [open, setOpen] = useState(false)
  const { data: categories, isPending } = useMenuCategories()

  const noCategories = !isPending && (categories?.length ?? 0) === 0

  // Disabled until categories have loaded, so the form never opens without any
  // to pick from.
  const button = (
    <Button
      disabled={isPending || noCategories}
      onClick={() => setOpen(true)}
    >
      <Plus />
      Add item
    </Button>
  )

  return (
    <>
      {noCategories ? (
        <Tooltip>
          {/* A disabled button swallows pointer events, so the span carries the
              hover target for the tooltip. */}
          <TooltipTrigger render={<span tabIndex={0} />}>
            {button}
          </TooltipTrigger>
          <TooltipContent>Create a category first</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <ItemFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
