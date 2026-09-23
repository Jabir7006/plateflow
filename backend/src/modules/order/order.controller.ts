import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import type {
  OrderStatusParamsSchema,
  PlaceOrderSchema,
} from "@plateflow/shared";
import orderService from "./order.service.js";

export const placeOrder = catchAsync(async (req, res) => {
  const { token } = req.params as PlaceOrderSchema["params"];
  const input = req.body as PlaceOrderSchema["body"];
  const order = await orderService.placeOrder(token, input);
  sendResponse(res, HTTP_STATUS.CREATED, order, "Order placed");
});

export const getOrderStatus = catchAsync(async (req, res) => {
  const { token, orderId } = req.params as OrderStatusParamsSchema["params"];
  const order = await orderService.getOrderStatus(token, orderId);
  sendResponse(res, HTTP_STATUS.SUCCESS, order);
});
