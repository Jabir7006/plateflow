import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getInitials } from "@/lib/initials"
import type { StaffOnShift } from "../data"

interface StaffShiftCardProps {
  staff: StaffOnShift[]
}

export function StaffShiftCard({ staff }: StaffShiftCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff on shift</CardTitle>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nobody on shift.</p>
        ) : (
          <ul className="divide-y divide-border">
            {staff.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <Avatar className={member.avatarClassName}>
                  <AvatarFallback className="bg-transparent">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {member.name}
                </p>
                <p className="shrink-0 text-sm text-muted-foreground">
                  {member.role}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
