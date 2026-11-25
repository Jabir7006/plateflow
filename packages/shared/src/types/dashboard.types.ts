import type { ReportingPeriod } from "./reporting.types.js";

export interface DashboardSummary {
  period: ReportingPeriod;
  // Served order totals, not collected payments. Management-only; other staff
  // receive null so the response never discloses a restricted sales figure.
  salesToday: number | null;
  activeOrders: number;
  tables: { occupied: number; total: number };
  outOfStock: { count: number; items: Array<{ id: string; name: string }> };
}
