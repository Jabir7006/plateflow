import { Router } from "express";
import menuCategoryRoutes from "../menu-category/menu-category.routes.js";
import menuItemRoutes from "../menu-item/menu-item.routes.js";

// The menu API is one surface (/api/v1/menu/*) built from two modules:
// categories, and the items inside them. Composing them here keeps a single
// mount point in `app.ts`, so there is one place that lists every /menu path and
// no chance of two routers disagreeing about which one owns a path.
const router = Router();

router.use(menuCategoryRoutes);
router.use(menuItemRoutes);

export default router;
