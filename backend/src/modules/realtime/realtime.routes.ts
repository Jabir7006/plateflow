import { Router } from "express";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import { issueTicket } from "./realtime.controller.js";

const router = Router();

// A logged-in staffer trades their session for a ~60s socket.io ticket. Gated to
// staff roles for parity with the staff order routes the ticket unlocks, so the
// two can't drift as per-role rules land.
router.get(
  "/ticket",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER, Role.CHEF, Role.WAITER),
  issueTicket
);

export default router;
