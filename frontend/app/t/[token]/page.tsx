import type { Metadata } from "next"

import { groupByCategory } from "@/features/menu/group-items"
import { getTableMenu } from "@/features/diner/api"
import { MenuExperience } from "@/features/diner/components/menu-experience"
import {
  InvalidToken,
  EmptyMenu,
} from "@/features/diner/components/menu-states"

export const metadata: Metadata = {
  title: "Menu — PlateFlow",
  description: "Browse the menu and order at your table.",
}

interface MenuPageProps {
  params: Promise<{ token: string }>
}

// Public menu a diner reaches by scanning a table QR. The token is resolved to a
// table + available menu on the server in one fetch; the interactive experience
// (view toggle, category deck, cart) is a client island that receives the
// already-grouped menu as props, so there's still no client data-fetching.
export default async function MenuPage({ params }: MenuPageProps) {
  const { token } = await params
  const menu = await getTableMenu(token)

  // `.menu-page` swaps in the fixed dark-premium espresso/amber surface for this
  // subtree only; the staff app's tokens are untouched.
  const shell = "menu-page min-h-dvh bg-background text-foreground"

  if (!menu) {
    return (
      <div className={shell}>
        <InvalidToken />
      </div>
    )
  }

  const groups = groupByCategory(menu.items)

  return (
    <div className={shell}>
      {groups.length === 0 ? (
        <EmptyMenu />
      ) : (
        <MenuExperience
          tableNumber={menu.table.number}
          groups={groups}
          token={token}
        />
      )}
    </div>
  )
}
