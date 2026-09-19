"use client"

import { useState } from "react"
import { Ellipsis, Pencil, QrCode, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Table } from "../api"
import { DeleteTableDialog } from "./delete-table-dialog"
import { QrDialog } from "./qr-dialog"
import { RegenerateQrDialog } from "./regenerate-qr-dialog"
import { TableFormDialog } from "./table-form-dialog"

interface TableActionsProps {
  table: Table
  // The trigger button; the card styles it.
  trigger?: React.ReactNode
}

// The edit/delete menu for a table card. Owns its dialog state so a grid only
// has to drop it in. Callers gate on canManage before rendering.
export function TableActions({ table, trigger }: TableActionsProps) {
  const [qrOpen, setQrOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
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
                size="icon-sm"
                aria-label={`Actions for table ${table.number}`}
              >
                <Ellipsis />
              </Button>
            )
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setQrOpen(true)}>
            <QrCode />
            View QR
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRegenerateOpen(true)}>
            <RefreshCw />
            Regenerate QR
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      <QrDialog open={qrOpen} onOpenChange={setQrOpen} table={table} />
      <RegenerateQrDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        table={table}
      />
      <TableFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        table={table}
      />
      <DeleteTableDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        table={table}
      />
    </>
  )
}
