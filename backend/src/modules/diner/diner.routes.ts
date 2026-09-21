import { Router } from "express";
import validate from "../../middlewares/validate.middleware.js";
import { tableTokenSchema } from "./diner.schema.js";
import { getTableMenu } from "./diner.controller.js";

const router = Router();

// Public and read-only: a diner scans a table's QR code and reads the menu with
// no account or session, like the existing public menu GETs. Writing anything
// is staff-only and lives in the other modules.
router.get("/:token", validate(tableTokenSchema), getTableMenu);

export default router;
