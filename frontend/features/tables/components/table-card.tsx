"use client"

import { Ellipsis } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { countLabel } from "@/lib/count-label"
import type { Table } from "../api"
import { TableActions } from "./table-actions"

interface TableCardProps {
  table: Table
  canManage: boolean
}

export function TableCard({ table, canManage }: TableCardProps) {
  return (
    <Card className="relative">
      {canManage ? (
        <TableActions
          table={table}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for table ${table.number}`}
              className="absolute top-2 right-2 text-muted-foreground"
            >
              <Ellipsis />
            </Button>
          }
        />
      ) : null}

      <CardContent className="flex flex-col items-center gap-1 py-6 text-center">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Table
        </span>
        <span className="text-3xl font-semibold tabular-nums">
          {table.number}
        </span>
        <span className="text-xs text-muted-foreground">
          {countLabel(table.orderCount, "order")}
        </span>
      </CardContent>
    </Card>
  )
}
