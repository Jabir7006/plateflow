import type {
  CreateTableSchema,
  TableIdSchema,
  UpdateTableSchema,
} from "@plateflow/shared";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import tableService from "./table.service.js";

export const listTables = catchAsync(async (_req, res) => {
  const tables = await tableService.list();
  sendResponse(res, HTTP_STATUS.SUCCESS, tables);
});

export const createTable = catchAsync(async (req, res) => {
  // Already parsed by `validate(createTableSchema)`, which coerces `number`.
  const { number } = req.body as CreateTableSchema["body"];
  const table = await tableService.create(number);
  sendResponse(res, HTTP_STATUS.CREATED, table, "Table created");
});

export const updateTable = catchAsync(async (req, res) => {
  const { id } = req.params as UpdateTableSchema["params"];
  const { number } = req.body as UpdateTableSchema["body"];
  const table = await tableService.update(id, number);
  sendResponse(res, HTTP_STATUS.SUCCESS, table, "Table updated");
});

export const deleteTable = catchAsync(async (req, res) => {
  const { id } = req.params as TableIdSchema["params"];
  await tableService.remove(id);
  sendResponse(res, HTTP_STATUS.SUCCESS, null, "Table deleted");
});
