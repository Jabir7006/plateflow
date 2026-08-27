import type { AuthUser, LoginSchema } from "@plateflow/shared";
import { prisma } from "../../lib/prisma.js";
import { User } from "../../generated/prisma/client.js";
import { UserStatus } from "../../generated/prisma/enums.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import { compareValue } from "../../utils/bcrypt.js";
import {
  accessTokenSignOptions,
  refreshTokenSignOptions,
  signToken,
} from "../../utils/jwt.js";

class AuthService {
  async login(
    loginData: LoginSchema,
    device?: string
  ): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
    const { email, password } = loginData.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    const isPasswordValid = await compareValue(password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.status === UserStatus.DISABLED) {
      throw new AppError("Account is disabled", HTTP_STATUS.FORBIDDEN);
    }

    const accessToken = signToken(
      {
        userId: user.id,
        role: user.role,
        status: user.status,
      },
      accessTokenSignOptions
    );

    const refreshToken = signToken(
      {
        userId: user.id,
      },
      refreshTokenSignOptions
    );

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
        device,
      },
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      } satisfies AuthUser,
      accessToken,
      refreshToken,
    };
  }

  async getMe(userId: User["id"]): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    if (user.status === UserStatus.DISABLED) {
      throw new AppError("Account is disabled", HTTP_STATUS.FORBIDDEN);
    }

    if (!user.password) {
      throw new AppError("User not found", HTTP_STATUS.NOT_FOUND);
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    } satisfies AuthUser;
  }
}

export default new AuthService();
