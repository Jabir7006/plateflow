"use client"

import { useState } from "react"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MenuItem } from "../api"
import { DeleteItemDialog } from "./delete-item-dialog"
import { ItemFormDialog } from "./item-form-dialog"

interface MenuItemActionsProps {
  item: MenuItem
  // The trigger button; card and row style it differently.
  trigger?: React.ReactNode
}

// The edit/delete menu shared by the card and the row. Owns its dialog state so
// a list only has to drop it in. Callers gate on canManage before rendering.
export function MenuItemActions({ item, trigger }: MenuItemActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            (trigger as React.ReactElement) ?? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${item.name}`}
              >
                <Ellipsis />
              </Button>
            )
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ItemFormDialog open={editOpen} onOpenChange={setEditOpen} item={item} />
      <DeleteItemDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        item={item}
      />
    </>
  )
}
