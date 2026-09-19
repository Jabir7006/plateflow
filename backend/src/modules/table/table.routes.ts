import { Router } from "express";
import {
  createTableSchema,
  tableIdSchema,
  updateTableSchema,
} from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  createTable,
  deleteTable,
  listTables,
  updateTable,
} from "./table.controller.js";

const router = Router();

// Every route here is staff-only: table management is a dashboard concern, not
// something a customer touches. (The public ordering route resolves a table by
// its QR token instead, and lives elsewhere.)
router.use(authenticate, requireRole(Role.OWNER, Role.MANAGER));

router.get("/", listTables);

router.post("/", validate(createTableSchema), createTable);

router.patch("/:id", validate(updateTableSchema), updateTable);

router.delete("/:id", validate(tableIdSchema), deleteTable);

export default router;
