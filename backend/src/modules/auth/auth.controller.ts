import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { setAuthCookies } from "../../utils/cookies.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import authService from "./auth.service.js";

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const device = req.headers["user-agent"];

  const { user, accessToken, refreshToken } = await authService.login(
    { body: { email, password } },
    device
  );

  setAuthCookies({ res, accessToken, refreshToken });

  sendResponse(res, 200, user, "Login successful");
});

export const getMe = catchAsync(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await authService.getMe(req.user.userId);

  sendResponse(res, 200, user, "User fetched successfully");
});
