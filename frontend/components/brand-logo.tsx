import { UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600",
        className
      )}
    >
      <UtensilsCrossed className="size-5 text-white" />
    </div>
  )
}
