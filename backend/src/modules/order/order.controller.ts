import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import type {
  OrderHistoryQuerySchema,
  OrderStatsQuerySchema,
  OrderStatusParamsSchema,
  PlaceOrderSchema,
  UpdateOrderStatusSchema,
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

// Staff surface — the authenticated live board and its status control.
export const listOrders = catchAsync(async (_req, res) => {
  const orders = await orderService.listActiveOrders();
  sendResponse(res, HTTP_STATUS.SUCCESS, orders);
});

export const listOrderHistory = catchAsync(async (req, res) => {
  // validate() has already coerced page/pageSize to numbers, so the parsed shape
  // no longer overlaps Express's all-string ParsedQs — cast through unknown.
  const query = req.query as unknown as OrderHistoryQuerySchema["query"];
  const result = await orderService.listOrderHistory(query);
  sendResponse(res, HTTP_STATUS.SUCCESS, result);
});

export const getOrderStats = catchAsync(async (req, res) => {
  const query = req.query as OrderStatsQuerySchema["query"];
  const stats = await orderService.getOrderStats(query);
  sendResponse(res, HTTP_STATUS.SUCCESS, stats);
});

export const updateOrderStatus = catchAsync(async (req, res) => {
  const { orderId } = req.params as UpdateOrderStatusSchema["params"];
  const { status } = req.body as UpdateOrderStatusSchema["body"];
  const order = await orderService.updateOrderStatus(orderId, status);
  sendResponse(res, HTTP_STATUS.SUCCESS, order, "Order updated");
});
