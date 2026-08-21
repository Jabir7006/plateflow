import { Router } from "express";
import { loginSchema } from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { login } from "./auth.controller.js";

const router = Router();

router.post("/login", validate(loginSchema), login);

export default router;
