import { Router } from "express";
import {
  createMenuCategorySchema,
  menuCategoryIdSchema,
  updateMenuCategorySchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  createMenuCategory,
  deleteMenuCategory,
  listMenuCategories,
  updateMenuCategory,
} from "./menu-category.controller.js";

const router = Router();

// Public: a customer who scans a table's QR code reads the menu without any
// account, so the list carries no session and exposes only category names and
// their item counts. Writing the menu is staff-only and gated below.
router.get("/categories", listMenuCategories);

router.post(
  "/categories",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(createMenuCategorySchema),
  createMenuCategory
);

router.patch(
  "/categories/:id",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(updateMenuCategorySchema),
  updateMenuCategory
);

router.delete(
  "/categories/:id",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(menuCategoryIdSchema),
  deleteMenuCategory
);

export default router;
