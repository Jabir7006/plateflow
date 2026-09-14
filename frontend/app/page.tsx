import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">PlateFlow</h1>
          <p>Public restaurant experiences will be added here later.</p>
          <Link href="/login" className={cn(buttonVariants(), "mt-2")}>
            Staff login
          </Link>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          Staff tools are protected behind authentication.
        </div>
      </div>
    </div>
  )
}
