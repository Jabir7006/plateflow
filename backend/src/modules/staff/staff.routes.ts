import { Router } from "express";
import { inviteSchema } from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import { inviteStaff } from "./staff.controller.js";

const router = Router();


router.post(
  "/invite",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(inviteSchema),
  inviteStaff
);

export default router;
