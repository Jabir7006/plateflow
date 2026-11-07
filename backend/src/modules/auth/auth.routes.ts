import { Router } from "express";
import {
  acceptInviteSchema,
  loginSchema,
  verifyInviteSchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authLimiter } from "../../middlewares/rate-limit.middleware.js";
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

router.post("/login", authLimiter, validate(loginSchema), login);
router.get(
  "/verify-invite",
  authLimiter,
  validate(verifyInviteSchema),
  verifyInvite
);
router.post(
  "/accept-invite",
  authLimiter,
  validate(acceptInviteSchema),
  acceptInvite
);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

export default router;
