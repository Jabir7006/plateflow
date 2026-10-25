import type {
  CreateTableSchema,
  TableIdSchema,
  UpdateTableSchema,
} from "@plateflow/shared";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import { requireTenant } from "../../middlewares/tenant.middleware.js";
import tableService from "./table.service.js";

export const listTables = catchAsync(async (req, res) => {
  const tables = await tableService.list(requireTenant(req));
  sendResponse(res, HTTP_STATUS.SUCCESS, tables);
});

export const createTable = catchAsync(async (req, res) => {
  // Already parsed by `validate(createTableSchema)`, which coerces `number`.
  const { number } = req.body as CreateTableSchema["body"];
  const table = await tableService.create(requireTenant(req), number);
  sendResponse(res, HTTP_STATUS.CREATED, table, "Table created");
});

export const updateTable = catchAsync(async (req, res) => {
  const { id } = req.params as UpdateTableSchema["params"];
  const { number } = req.body as UpdateTableSchema["body"];
  const table = await tableService.update(requireTenant(req), id, number);
  sendResponse(res, HTTP_STATUS.SUCCESS, table, "Table updated");
});

export const deleteTable = catchAsync(async (req, res) => {
  const { id } = req.params as TableIdSchema["params"];
  await tableService.remove(requireTenant(req), id);
  sendResponse(res, HTTP_STATUS.SUCCESS, null, "Table deleted");
});

export const regenerateTableQr = catchAsync(async (req, res) => {
  const { id } = req.params as TableIdSchema["params"];
  const table = await tableService.regenerateQr(requireTenant(req), id);
  sendResponse(res, HTTP_STATUS.SUCCESS, table, "QR code regenerated");
});
