import type { DashboardSummary } from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary")
}
