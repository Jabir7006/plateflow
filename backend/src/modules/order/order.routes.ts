import { Router } from "express";
import { orderStatusParamsSchema, placeOrderSchema } from "@plateflow/shared";
import validate from "../../middlewares/validate.middleware.js";
import { getOrderStatus, placeOrder } from "./order.controller.js";

const router = Router();

// Public and token-scoped, like the diner menu it sits beside: a diner places an
// order and reads its status with no account. The table's QR token in the path
// is the only key; there is no staff order surface here (advancing status lives
// with the later kitchen display).
router.post("/:token/orders", validate(placeOrderSchema), placeOrder);
router.get(
  "/:token/orders/:orderId",
  validate(orderStatusParamsSchema),
  getOrderStatus
);

export default router;
