import { verifyToken, accessTokenPayload } from "../../utils/jwt.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import { Role } from "../../generated/prisma/enums.js";
import catchAsync from "../../utils/catchAsync.js";

export const authenticate = catchAsync(async (req, _res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return next(
      new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED)
    );
  }

  try {
    const decoded = verifyToken(token) as accessTokenPayload;
    req.user = decoded;
    return next();
  } catch {
    return next(
      new AppError("Invalid or expired token", HTTP_STATUS.UNAUTHORIZED)
    );
  }
});

export const requireRole = (...allowedRoles: Role[]) => {
  return catchAsync(async (req, _res, next) => {
    if (!req.user) {
      return next(
        new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
      );
    }

    return next();
  });
};
