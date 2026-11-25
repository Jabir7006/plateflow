import type { DashboardSummary } from "@plateflow/shared";
import { OrderStatus, Role } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { getReportingPeriod } from "../order/reporting.service.js";
import { reportingCreatedAt } from "../../lib/reporting-period.js";

class DashboardService {
  async summary(restaurantId: string, role: Role): Promise<DashboardSummary> {
    const period = await getReportingPeriod(restaurantId, { preset: "today" });
    const canViewSales = role === Role.OWNER || role === Role.MANAGER;
    const unavailableWhere = { restaurantId, isAvailable: false };

    const [active, totalTables, unavailableCount, unavailableItems, sales] =
      await Promise.all([
        prisma.order.findMany({
          where: {
            restaurantId,
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.PREPARING,
                OrderStatus.READY,
              ],
            },
          },
          select: { tableId: true },
        }),
        prisma.table.count({ where: { restaurantId } }),
        prisma.menuItem.count({ where: unavailableWhere }),
        prisma.menuItem.findMany({
          where: unavailableWhere,
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 5,
        }),
        // Skip the money query entirely for CHEF/WAITER, rather than hiding a
        // number in the UI after sending it to a role that cannot see reports.
        canViewSales
          ? prisma.order.aggregate({
              where: {
                restaurantId,
                status: OrderStatus.SERVED,
                createdAt: reportingCreatedAt(period),
              },
              _sum: { total: true },
            })
          : Promise.resolve(null),
      ]);

    return {
      period,
      salesToday: sales === null ? null : (sales._sum.total?.toNumber() ?? 0),
      activeOrders: active.length,
      tables: {
        occupied: new Set(active.map((order) => order.tableId)).size,
        total: totalTables,
      },
      outOfStock: { count: unavailableCount, items: unavailableItems },
    };
  }
}

export default new DashboardService();
