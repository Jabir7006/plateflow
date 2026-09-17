import { Router } from "express";
import {
  acceptInviteSchema,
  loginSchema,
  verifyInviteSchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate } from "./auth.middleware.js";
import {
  acceptInvite,
  getMe,
  login,
  logout,
  refresh,
  verifyInvite,
} from "./auth.controller.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.get("/verify-invite", validate(verifyInviteSchema), verifyInvite);
router.post("/accept-invite", validate(acceptInviteSchema), acceptInvite);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

export default router;
