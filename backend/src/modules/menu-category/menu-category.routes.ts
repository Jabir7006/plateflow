import { Router } from "express";
import {
  createMenuCategorySchema,
  menuCategoryIdSchema,
  updateMenuCategorySchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { tenantContext } from "../../middlewares/tenant.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  createMenuCategory,
  deleteMenuCategory,
  listMenuCategories,
  updateMenuCategory,
} from "./menu-category.controller.js";

const router = Router();

// Staff-only. This used to be public because one deployment meant one menu; with
// several restaurants in one database an unscoped public list would show every
// restaurant's categories. A diner reads the menu through their table's token
// (GET /t/:token), which resolves the tenant from the QR code.
router.get(
  "/categories",
  authenticate,
  tenantContext,
  requireRole(Role.OWNER, Role.MANAGER, Role.CHEF, Role.WAITER),
  listMenuCategories
);

router.post(
  "/categories",
  authenticate,
  tenantContext,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(createMenuCategorySchema),
  createMenuCategory
);

router.patch(
  "/categories/:id",
  authenticate,
  tenantContext,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(updateMenuCategorySchema),
  updateMenuCategory
);

router.delete(
  "/categories/:id",
  authenticate,
  tenantContext,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(menuCategoryIdSchema),
  deleteMenuCategory
);

export default router;
