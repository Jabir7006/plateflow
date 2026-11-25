import { HTTP_STATUS } from "../../constants/http.js";
import { requireTenant } from "../../middlewares/tenant.middleware.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import catchAsync from "../../utils/catchAsync.js";
import dashboardService from "./dashboard.service.js";

export const getDashboardSummary = catchAsync(async (req, res) => {
  const summary = await dashboardService.summary(
    requireTenant(req),
    req.user!.role
  );
  sendResponse(res, HTTP_STATUS.SUCCESS, summary);
});
