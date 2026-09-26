import { Router } from "express";
import {
  orderHistoryQuerySchema,
  orderStatsQuerySchema,
  updateOrderStatusSchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  getOrderStats,
  listOrderHistory,
  listOrders,
  updateOrderStatus,
} from "./order.controller.js";

const router = Router();

// The authenticated staff order surface, separate from the public token-scoped
// diner routes. Every route needs a staff session; any staff role may view and
// advance orders (per-role rules — e.g. only a chef marks READY — are a later
// refinement).
router.use(
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER, Role.CHEF, Role.WAITER)
);

router.get("/", listOrders);
// History is the full paged record behind the board; stats is the sales summary.
router.get("/history", validate(orderHistoryQuerySchema), listOrderHistory);
// Sales figures (revenue + per-status money) are management-only — the board and
// history stay all-staff, but financial reporting is tightened to OWNER/MANAGER
// on top of the router's staff guard.
router.get(
  "/stats",
  requireRole(Role.OWNER, Role.MANAGER),
  validate(orderStatsQuerySchema),
  getOrderStats
);
router.patch("/:orderId/status", validate(updateOrderStatusSchema), updateOrderStatus);

export default router;
