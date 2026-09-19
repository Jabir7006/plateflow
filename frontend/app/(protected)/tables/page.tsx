import { PageHeader } from "@/features/dashboard/components/page-header"
import { TablesGrid } from "@/features/tables/components/tables-grid"
import { TablesHeaderActions } from "@/features/tables/components/tables-header-actions"

// Server component: the shell is static, and the interactive parts (the header
// action and the grid) are the only client islands.
export default function TablesPage() {
  return (
    <>
      <PageHeader
        title="Tables"
        description="Register your tables and their QR codes."
        actions={<TablesHeaderActions />}
      />

      <section aria-label="Tables" className="mt-6">
        <TablesGrid />
      </section>
    </>
  )
}
