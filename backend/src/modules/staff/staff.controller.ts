import type { InviteSchema } from "@plateflow/shared";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import { requireTenant } from "../../middlewares/tenant.middleware.js";
import staffService from "./staff.service.js";

export const inviteStaff = catchAsync(async (req, res) => {
  // `authenticate` + `tenantContext` have already proven the session; the role
  // comes from the same signed token.
  const invited = await staffService.invite(
    requireTenant(req),
    req.body as InviteSchema["body"],
    req.user!.role
  );

  sendResponse(res, HTTP_STATUS.CREATED, invited, "Invitation sent");
});
