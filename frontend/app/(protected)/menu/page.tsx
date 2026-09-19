import { PageHeader } from "@/features/dashboard/components/page-header"
import { MenuActions } from "@/features/menu/components/menu-actions"
import { MenuItemsList } from "@/features/menu/components/menu-items-list"

// Server component: the shell is static, and the interactive parts (the header
// actions and the item list) are the only client islands.
export default function MenuPage() {
  return (
    <>
      <PageHeader
        title="Menu"
        description="Your dishes, grouped by category."
        actions={<MenuActions />}
      />

      <section aria-label="Menu items" className="mt-6">
        <MenuItemsList />
      </section>
    </>
  )
}
