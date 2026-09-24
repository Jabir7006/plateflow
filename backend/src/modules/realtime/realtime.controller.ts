import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import AppError from "../../utils/AppError.js";
import type { RealtimeTicket } from "@plateflow/shared";
import { signWsTicket } from "../../realtime/ticket.js";

// Mint a short-lived socket.io handshake ticket for the current staff session.
// `authenticate` has already proven the session from the access cookie; we just
// re-issue it in a form the cross-origin socket can carry.
export const issueTicket = catchAsync(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  const { userId, role } = req.user;
  const payload: RealtimeTicket = { ticket: signWsTicket({ userId, role }) };
  sendResponse(res, HTTP_STATUS.SUCCESS, payload);
});
