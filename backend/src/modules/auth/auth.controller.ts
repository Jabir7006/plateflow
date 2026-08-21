import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { setAuthCookies } from "../../utils/cookies.js";
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
