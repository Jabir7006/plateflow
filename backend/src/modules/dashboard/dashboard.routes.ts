import { Router } from "express";
import { Role } from "../../generated/prisma/enums.js";
import { tenantContext } from "../../middlewares/tenant.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { getDashboardSummary } from "./dashboard.controller.js";

const router = Router();

router.use(
  authenticate,
  tenantContext,
  requireRole(Role.OWNER, Role.MANAGER, Role.CHEF, Role.WAITER)
);
router.get("/summary", getDashboardSummary);

export default router;
