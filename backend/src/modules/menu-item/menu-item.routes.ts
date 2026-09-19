import { Router } from "express";
import {
  createMenuItemSchema,
  listMenuItemsSchema,
  menuItemIdSchema,
  updateMenuItemSchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { menuItemImageUpload } from "../../middlewares/upload.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  removeMenuItemImage,
  updateMenuItem,
  updateMenuItemImage,
} from "./menu-item.controller.js";

const router = Router();

// Public: a customer who scans a table's QR code reads the menu without any
// account. The payload is shaped for that audience — no storage id, nothing
// internal — and availability is included so the customer menu can filter on
// it. Writing the menu is staff-only and gated below.
router.get("/items", validate(listMenuItemsSchema), listMenuItems);

router.post(
  "/items",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(createMenuItemSchema),
  createMenuItem
);

// Availability is flipped through this same endpoint rather than a dedicated
// route: it is one of the item's fields, and a second way to write it would be
// a second thing to keep in step with the schema.
router.patch(
  "/items/:id",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(updateMenuItemSchema),
  updateMenuItem
);

router.delete(
  "/items/:id",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(menuItemIdSchema),
  deleteMenuItem
);

// An item's photo is a subresource rather than a field on PATCH: the body is
// multipart, and PUT says what happens — an item has one photo and sending
// another replaces it. Deleting the item takes its photo with it, so the DELETE
// below is only for "this item has no photo now".
router.put(
  "/items/:id/image",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  menuItemImageUpload,
  validate(menuItemIdSchema),
  updateMenuItemImage
);

router.delete(
  "/items/:id/image",
  authenticate,
  requireRole(Role.OWNER, Role.MANAGER),
  validate(menuItemIdSchema),
  removeMenuItemImage
);

export default router;
