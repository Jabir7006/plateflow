import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import type { TableTokenSchema } from "./diner.schema.js";
import dinerService from "./diner.service.js";

export const getTableMenu = catchAsync(async (req, res) => {
  const { token } = req.params as TableTokenSchema["params"];
  const menu = await dinerService.getTableMenu(token);
  sendResponse(res, HTTP_STATUS.SUCCESS, menu);
});
