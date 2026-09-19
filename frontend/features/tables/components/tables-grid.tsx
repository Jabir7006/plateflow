"use client"

import { LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getErrorMessage } from "@/lib/api-error"
import { useTables } from "../hooks/use-tables"
import { useCanManageTables } from "../hooks/use-can-manage-tables"
import { TableCard } from "./table-card"
import { TablesSkeleton } from "./tables-skeleton"
import { tablesGridClass } from "./grid-class"

export function TablesGrid() {
  const canManage = useCanManageTables()
  const { data, isPending, isError, error, refetch, isFetching } = useTables()

  if (isPending) {
    return <TablesSkeleton />
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error) ?? "We couldn't load your tables."}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="mb-1 inline-flex size-11 items-center justify-center rounded-full bg-muted">
            <LayoutGrid className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No tables yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {canManage
              ? "Add your tables so each one gets a QR code customers can scan to order."
              : "No tables have been set up yet."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={tablesGridClass}>
      {data.map((table) => (
        <TableCard key={table.id} table={table} canManage={canManage} />
      ))}
    </div>
  )
}
