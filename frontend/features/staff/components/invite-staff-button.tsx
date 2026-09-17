"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InviteStaffDialog } from "./invite-staff-dialog"

/**
 * The trigger and its dialog are kept together so the open state never leaves
 * this boundary; the dialog itself stays controlled and reusable elsewhere.
 */
export function InviteStaffButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Invite staff
      </Button>

      <InviteStaffDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
