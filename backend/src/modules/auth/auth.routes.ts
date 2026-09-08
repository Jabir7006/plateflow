import { Router } from "express";
import { loginSchema } from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate } from "./auth.middleware.js";
import { getMe, login, logout, refresh } from "./auth.controller.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

export default router;
