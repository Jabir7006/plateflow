"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddCategoryButton } from "./add-category-button"
import { CategoryList } from "./category-list"

/**
 * Categories are setup, not daily work, so they live behind this button rather
 * than on the page. The full category CRUD (add, rename, delete) is reused
 * as-is inside the dialog; its own create/edit/delete dialogs stack on top.
 */
export function ManageCategoriesButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal />
        Manage categories
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Menu categories</DialogTitle>
            <DialogDescription>
              Group your dishes so the menu stays easy to scan.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <AddCategoryButton />
          </div>

          <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
            <CategoryList />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
