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
import type { MenuCategory } from "../api"
import { countLabel } from "@/lib/count-label"
import { CategoryFormDialog } from "./category-form-dialog"
import { DeleteCategoryDialog } from "./delete-category-dialog"

interface CategoryRowProps {
  category: MenuCategory
  // When false the row is read-only. The backend is the real gate; this only
  // avoids offering controls that would be rejected.
  canManage: boolean
}

export function CategoryRow({ category, canManage }: CategoryRowProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{category.name}</p>
        <p className="text-xs text-muted-foreground">
          {countLabel(category.itemCount, "item")}
        </p>
      </div>

      {canManage ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${category.name}`}
                >
                  <Ellipsis />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil />
                Rename
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

          <CategoryFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            category={category}
          />
          <DeleteCategoryDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            category={category}
          />
        </>
      ) : null}
    </li>
  )
}
