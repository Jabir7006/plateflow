"use client"

import { orderStatusValues, type OrderStatus } from "@plateflow/shared"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RANGE_PRESETS, type RangePreset } from "../date-range"
import { HISTORY_STATUS_BADGE } from "../status"

const STATUS_OPTIONS: readonly OrderStatus[] = orderStatusValues

const rangeLabel = (preset: RangePreset) =>
  RANGE_PRESETS.find((p) => p.value === preset)?.label ?? "Select range"

export interface OrderHistoryFiltersProps {
  rangePreset: RangePreset
  onRangePreset: (preset: RangePreset) => void
  customFrom: string
  customTo: string
  onCustomChange: (next: { from: string; to: string }) => void
  status: OrderStatus | "ALL"
  onStatusChange: (status: OrderStatus | "ALL") => void
  rangeError?: string | null
}

export function OrderHistoryFilters({
  rangePreset,
  onRangePreset,
  customFrom,
  customTo,
  onCustomChange,
  status,
  onStatusChange,
  rangeError,
}: OrderHistoryFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="history-range" className="text-xs text-muted-foreground">
            Range
          </Label>
          <Select
            value={rangePreset}
            onValueChange={(next) => {
              if (next !== null) onRangePreset(next as RangePreset)
            }}
          >
            <SelectTrigger id="history-range" className="h-9 w-40">
              <SelectValue>
                {(value: RangePreset | null) =>
                  value ? rangeLabel(value) : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rangePreset === "custom" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="range-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="range-from"
                type="date"
                className="h-9 w-40"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) =>
                  onCustomChange({ from: e.target.value, to: customTo })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="range-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="range-to"
                type="date"
                className="h-9 w-40"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) =>
                  onCustomChange({ from: customFrom, to: e.target.value })
                }
              />
            </div>
          </>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="history-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(next) => {
              if (next !== null) onStatusChange(next as OrderStatus | "ALL")
            }}
          >
            <SelectTrigger id="history-status" className="h-9 w-40">
              <SelectValue>
                {(value: OrderStatus | "ALL" | null) =>
                  !value || value === "ALL"
                    ? "All statuses"
                    : HISTORY_STATUS_BADGE[value].label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {HISTORY_STATUS_BADGE[option].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rangeError ? (
        <p className="text-sm text-destructive">{rangeError}</p>
      ) : null}
    </div>
  )
}
