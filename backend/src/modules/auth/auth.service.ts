import type { AuthUser, InvitePreview, LoginSchema } from "@plateflow/shared";
import { prisma } from "../../lib/prisma.js";
import {
  Prisma,
  RefreshToken,
  User,
  VerificationToken,
} from "../../generated/prisma/client.js";
import {
  RevokeReason,
  TokenType,
  UserStatus,
} from "../../generated/prisma/enums.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import {
  REFRESH_REUSE_GRACE,
  REFRESH_TOKEN_RETENTION,
  TOKEN_TTL,
} from "../../constants/auth.js";
import { compareValue, hashValue } from "../../utils/bcrypt.js";
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

type UsableInvite = VerificationToken & { user: User };

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

  async acceptInvite(
    rawToken: string,
    password: string,
    context: SessionContext = {}
  ): Promise<AuthSession> {
    const invite = await this.loadUsableInvite(rawToken);

    // Hashed before the transaction opens: bcrypt is deliberately slow, and
    // holding a pooled connection for its duration would tie up the pool for the
    // span of every signup.
    const passwordHash = await hashValue(password);

    const user = await prisma.$transaction(async (tx) => {
      // Claiming the invitation means deleting it. A second request arriving with
      // the same link finds nothing to delete and stops here, before it can
      // overwrite the password the first one just chose.
      const claimed = await tx.verificationToken.deleteMany({
        where: { id: invite.id },
      });

      if (claimed.count === 0) {
        throw new AppError(
          "This invitation has already been accepted",
          HTTP_STATUS.CONFLICT
        );
      }

      // Any other outstanding invitation for this account dies with the one that
      // was spent, so an older link cannot be replayed into a second password
      // reset afterwards.
      await tx.verificationToken.deleteMany({
        where: { userId: invite.userId, type: TokenType.STAFF_INVITE },
      });

      return tx.user.update({
        where: { id: invite.userId },
        data: { password: passwordHash, status: UserStatus.ACTIVE },
      });
    });

    // The invitee chose a password seconds ago, so hand them the session they
    // were heading for rather than a second trip through the login form.
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

  // Read-only: the same checks acceptance runs, without spending the token, so
  // the invitee sees "this link expired" on page load instead of after typing a
  // password. Reuses loadUsableInvite so the two entry points cannot drift into
  // disagreeing about what a usable invitation is.
  async verifyInvite(rawToken: string): Promise<InvitePreview> {
    const { user, expiresAt } = await this.loadUsableInvite(rawToken);

    return {
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      expiresAt: expiresAt.toISOString(),
    };
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

    this.schedulePruneDeadTokens(stored.userId);

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
      throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.status === UserStatus.DISABLED) {
      throw new AppError("Account is disabled", HTTP_STATUS.FORBIDDEN);
    }

    if (!user.password) {
      throw new AppError("Authentication required", HTTP_STATUS.UNAUTHORIZED);
    }

    return toAuthUser(user);
  }

  private async loadUsableInvite(rawToken: string): Promise<UsableInvite> {
    // Matched on the digest: the raw value was never stored, so a database read
    // cannot be turned back into a working link.
    const invite = await prisma.verificationToken.findUnique({
      where: { token: sha256(rawToken) },
      include: { user: true },
    });

    if (!invite || invite.type !== TokenType.STAFF_INVITE) {
      throw new AppError(
        "This invitation link is not valid",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new AppError(
        "This invitation has expired, ask your manager to send a new one",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (invite.user.status === UserStatus.DISABLED) {
      throw new AppError("Account is disabled", HTTP_STATUS.FORBIDDEN);
    }

    // A spent invitation row is deleted, so an active account here means the
    // account was activated some other way and this link is simply stale.
    if (invite.user.status === UserStatus.ACTIVE) {
      throw new AppError(
        "This invitation has already been accepted",
        HTTP_STATUS.CONFLICT
      );
    }

    return invite;
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

  // Detached: a failure here happens after rotate() committed, and must not
  // fail the response that carries the new cookies. Needs a long-lived process.
  private schedulePruneDeadTokens(userId: User["id"]): void {
    void this.pruneDeadTokens(userId).catch((error: unknown) => {
      console.error("Failed to prune dead refresh tokens:", {
        userId,
        error,
      });
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
