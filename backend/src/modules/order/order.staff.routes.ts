import { Router } from "express";
import { updateOrderStatusSchema } from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import { listOrders, updateOrderStatus } from "./order.controller.js";

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
router.patch("/:orderId/status", validate(updateOrderStatusSchema), updateOrderStatus);

export default router;
