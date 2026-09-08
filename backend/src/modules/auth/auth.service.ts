import type { AuthUser, LoginSchema } from "@plateflow/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, RefreshToken, User } from "../../generated/prisma/client.js";
import { RevokeReason, UserStatus } from "../../generated/prisma/enums.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import {
  REFRESH_REUSE_GRACE,
  REFRESH_TOKEN_RETENTION,
  TOKEN_TTL,
} from "../../constants/auth.js";
import { compareValue } from "../../utils/bcrypt.js";
import { randomId, sha256 } from "../../utils/crypto.js";
import {
  accessTokenSignOptions,
  refreshTokenSignOptions,
  signToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";

export type SessionContext = {
  device?: string | undefined;
  ip?: string | undefined;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type IssuedTokens = Pick<AuthSession, "accessToken" | "refreshToken">;

type SessionChain = {
  sessionId: string;
  sessionExpiresAt: Date;
};

type StoredRefreshToken = RefreshToken & { user: User };

export class ConcurrentRefreshError extends AppError {
  constructor() {
    super(
      "Refresh token was already rotated by a concurrent request, please retry",
      HTTP_STATUS.CONFLICT
    );
  }
}

const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
});

class AuthService {
  async login(
    loginData: LoginSchema,
    context: SessionContext = {}
  ): Promise<AuthSession> {
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

    const tokens = await this.issueTokens(
      user,
      {
        sessionId: randomId(16),
        sessionExpiresAt: new Date(Date.now() + TOKEN_TTL.SESSION_ABSOLUTE),
      },
      context
    );

    return { user: toAuthUser(user), ...tokens };
  }

  async refreshSession(
    rawToken: string,
    context: SessionContext = {}
  ): Promise<AuthSession> {
    const payload = verifyRefreshToken(rawToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });

    if (!stored) {
      await this.revokeSession(payload.sessionId, RevokeReason.REUSE_DETECTED);
      throw new AppError("Invalid refresh token", HTTP_STATUS.UNAUTHORIZED);
    }

    await this.assertChainIsLive(stored);
    await this.assertUserCanRefresh(stored.user, stored.sessionId);

    const tokens = await this.rotate(stored, context);

    await this.pruneDeadTokens(stored.userId);

    return { user: toAuthUser(stored.user), ...tokens };
  }

  async logoutCurrentSession(rawRefreshToken: string): Promise<void> {
    const { sessionId } = verifyRefreshToken(rawRefreshToken);

    await this.revokeSession(sessionId, RevokeReason.LOGOUT);
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

    return toAuthUser(user);
  }

  private async rotate(
    stored: StoredRefreshToken,
    context: SessionContext
  ): Promise<IssuedTokens> {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: RevokeReason.ROTATED },
      });

      if (claimed.count === 0) {
        throw new ConcurrentRefreshError();
      }

      return this.issueTokens(
        stored.user,
        {
          sessionId: stored.sessionId,
          sessionExpiresAt: stored.sessionExpiresAt,
        },
        context,
        tx
      );
    });
  }

  private async assertChainIsLive(stored: StoredRefreshToken): Promise<void> {
    const now = Date.now();

    if (stored.revokedAt) {
      if (stored.revokedReason === RevokeReason.ROTATED) {
        if (now - stored.revokedAt.getTime() <= REFRESH_REUSE_GRACE) {
          throw new ConcurrentRefreshError();
        }

        await this.revokeSession(stored.sessionId, RevokeReason.REUSE_DETECTED);
        throw new AppError(
          "Session was ended for security reasons, please sign in again",
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      throw new AppError(
        "Refresh token is no longer valid",
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (stored.expiresAt.getTime() <= now) {
      await this.revokeSession(stored.sessionId, RevokeReason.SESSION_EXPIRED);
      throw new AppError("Refresh token expired", HTTP_STATUS.UNAUTHORIZED);
    }

    if (stored.sessionExpiresAt.getTime() <= now) {
      await this.revokeSession(stored.sessionId, RevokeReason.SESSION_EXPIRED);
      throw new AppError(
        "Session expired, please sign in again",
        HTTP_STATUS.UNAUTHORIZED
      );
    }
  }

  private async assertUserCanRefresh(
    user: User,
    sessionId: string
  ): Promise<void> {
    if (user.status === UserStatus.DISABLED || !user.password) {
      await this.revokeSession(sessionId, RevokeReason.USER_DISABLED);
      throw new AppError("Account is disabled", HTTP_STATUS.FORBIDDEN);
    }
  }

  private async issueTokens(
    user: Pick<User, "id" | "role" | "status">,
    chain: SessionChain,
    context: SessionContext,
    client: Prisma.TransactionClient = prisma
  ): Promise<IssuedTokens> {
    const accessToken = signToken(
      {
        userId: user.id,
        role: user.role,
        status: user.status,
      },
      accessTokenSignOptions
    );

    // Clamped so the sliding expiry can never reach past the chain's ceiling.
    const expiresAt = new Date(
      Math.min(Date.now() + TOKEN_TTL.REFRESH, chain.sessionExpiresAt.getTime())
    );

    const refreshToken = signToken(
      {
        userId: user.id,
        sessionId: chain.sessionId,
        jti: randomId(),
      },
      {
        ...refreshTokenSignOptions,
        // Keeps the JWT's own `exp` in step with the row's `expiresAt`.
        expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      }
    );

    await client.refreshToken.create({
      data: {
        tokenHash: sha256(refreshToken),
        userId: user.id,
        sessionId: chain.sessionId,
        expiresAt,
        sessionExpiresAt: chain.sessionExpiresAt,
        device: context.device ?? null,
        ip: context.ip ?? null,
      },
    });

    return { accessToken, refreshToken };
  }
  private async revokeSession(
    sessionId: string,
    reason: RevokeReason
  ): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private async pruneDeadTokens(userId: User["id"]): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date(Date.now() - REFRESH_TOKEN_RETENTION) },
      },
    });
  }
}

export default new AuthService();
