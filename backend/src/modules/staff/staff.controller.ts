import type { InviteSchema } from "@plateflow/shared";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import staffService from "./staff.service.js";

export const inviteStaff = catchAsync(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  // Already parsed by `validate(inviteSchema)`, which writes the trimmed and
  // lowercased result back onto `req.body`.
  const invited = await staffService.invite(
    req.body as InviteSchema["body"],
    req.user.role
  );

  sendResponse(res, HTTP_STATUS.CREATED, invited, "Invitation sent");
});
