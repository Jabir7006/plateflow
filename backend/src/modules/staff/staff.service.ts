import type { InviteSchema, InvitedStaff, Role } from "@plateflow/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  TokenType,
  UserStatus as PrismaUserStatus,
} from "../../generated/prisma/enums.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import { TOKEN_TTL } from "../../constants/auth.js";
import { randomId, sha256 } from "../../utils/crypto.js";
import { ENV } from "../../config/env.js";
import { sendEmail } from "../../lib/mail.js";
import { buildStaffInviteEmail } from "./staff-invite.template.js";

type InviteInput = InviteSchema["body"];

class StaffService {
  async invite(
    restaurantId: string,
    { fullName, email, role }: InviteInput,
    actorRole: Role
  ): Promise<InvitedStaff> {
    // Checked against the role being granted and, below, against the role the
    // target already holds: without the second check a manager could re-invite an
    // existing manager as a waiter and demote them that way.
    this.assertMayManage(actorRole, role);

    // Email is globally unique (one person, one account), so this lookup can
    // return a user from another restaurant. That account is not ours to touch:
    // re-roling or re-inviting it would let one restaurant seize another's staff
    // member. The response is the same generic conflict either way, so it does
    // not disclose which restaurant the address belongs to.
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, status: true, restaurantId: true },
    });

    if (existing && existing.restaurantId !== restaurantId) {
      throw new AppError(
        "This email is already in use",
        HTTP_STATUS.CONFLICT
      );
    }

    if (existing) {
      this.assertMayManage(actorRole, existing.role);
    }

    if (existing?.status === PrismaUserStatus.ACTIVE) {
      throw new AppError(
        "This email already belongs to an active account",
        HTTP_STATUS.CONFLICT
      );
    }

    if (existing?.status === PrismaUserStatus.DISABLED) {
      throw new AppError(
        "This account is disabled, re-enable it instead of re-inviting",
        HTTP_STATUS.CONFLICT
      );
    }

    // A user who is already INVITED is not a conflict: re-inviting is how a
    // manager replaces an invitation that expired or never arrived.
    const inviteToken = randomId(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL.STAFF_INVITE);
    const isNewUser = !existing;

    // Two invites for the same new email can both pass the lookup above; the
    // loser is rejected by the unique index on `email` and reported as a 409.
    const { user, tokenId } = await prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user
            // The tenant rides the write itself. Checking ownership above and
            // then writing by id alone would leave a window in which the account
            // is reassigned to another restaurant and still gets edited here.
            .update({
              where: { id: existing.id, restaurantId },
              data: { fullName, role },
            })
            .catch((error: unknown) => {
              // No row matched the id *and* the tenant: the account moved (or
              // vanished) since the lookup. Same generic conflict as above.
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2025"
              ) {
                throw new AppError(
                  "This email is already in use",
                  HTTP_STATUS.CONFLICT
                );
              }
              throw error;
            })
        : await tx.user.create({
            data: {
              fullName,
              email,
              role,
              status: PrismaUserStatus.INVITED,
              restaurantId,
            },
          });

      const token = await tx.verificationToken.create({
        data: {
          // The column holds a digest; the raw value only ever exists in the
          // email, so a leaked database read cannot be turned into a live link.
          token: sha256(inviteToken),
          type: TokenType.STAFF_INVITE,
          userId: user.id,
          expiresAt,
        },
      });

      return { user, tokenId: token.id };
    });

    const inviteUrl = `${ENV.APP_URL}/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    try {
      await sendEmail({
        to: user.email,
        ...buildStaffInviteEmail({
          fullName: user.fullName,

          role,
          inviteUrl,
          expiresAt,
        }),
      });
    } catch (error) {
      // Better to report "nothing happened" than to leave an account marked
      // invited whose invitation nobody received.
      await this.discardInvite(restaurantId, user.id, tokenId, isNewUser);
      throw error;
    }

    // Superseded only once this invitation is known to have gone out, so a failed
    // send can never be the thing that invalidates the link already in hand.
    await prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: TokenType.STAFF_INVITE,
        id: { not: tokenId },
      },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      inviteExpiresAt: expiresAt.toISOString(),
    };
  }

  // A manager is not a peer of another manager: only the owner may create,
  // re-role, or otherwise touch one. Without this a manager could demote or
  // remove the account that owns the restaurant, and deleting it would cascade
  // away that account's sessions, leaving no way back in.
  private assertMayManage(actorRole: Role, targetRole: Role): void {
    if (targetRole === "OWNER") {
      throw new AppError(
        "The owner account cannot be managed from here",
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (targetRole === "MANAGER" && actorRole !== "OWNER") {
      throw new AppError(
        "Only the owner can invite or change a manager",
        HTTP_STATUS.FORBIDDEN
      );
    }
  }

  // Best effort: the invite has already failed, and a rollback failure must not
  // replace the error the caller needs to see.
  private async discardInvite(
    restaurantId: string,
    userId: string,
    tokenId: string,
    isNewUser: boolean
  ): Promise<void> {
    try {
      if (isNewUser) {
        // Cascades to the token row. Scoped by restaurant so a rollback can only
        // ever remove the account this invite created.
        await prisma.user.deleteMany({ where: { id: userId, restaurantId } });
        return;
      }

      await prisma.verificationToken.delete({ where: { id: tokenId } });
    } catch (error) {
      console.error("Failed to discard invite after a failed send:", {
        userId,
        error,
      });
    }
  }
}

export default new StaffService();
