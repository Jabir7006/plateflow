import type { OwnerSignupPreview } from "@plateflow/shared";
import { ENV } from "../../config/env.js";
import { HTTP_STATUS } from "../../constants/http.js";
import {
  SIGNUP_RESEND_COOLDOWN,
  TOKEN_TTL,
} from "../../constants/auth.js";
import { prisma } from "../../lib/prisma.js";
import { sendSignupEmail } from "../../lib/mail.js";
import { randomId, sha256 } from "../../utils/crypto.js";
import AppError from "../../utils/AppError.js";
import { buildOwnerSignupEmail } from "./owner-signup.template.js";

// One message for every unusable link: unknown, expired, rotated or spent. A
// caller cannot learn which of those applies (or whether the address exists).
export const INVALID_SIGNUP_LINK =
  "This signup link is invalid or has expired. Request a new link.";

// Returned for every syntactically valid request, including addresses that
// already have an account, resends inside the cooldown, and failed deliveries.
export const OWNER_SIGNUP_REQUEST_MESSAGE =
  "If this address can sign up, a link is on its way. Check your inbox.";

const EXPIRED_CLEANUP_LIMIT = 100;

/**
 * Issues a fresh signup link for the address. The transaction-scoped advisory
 * lock serializes requests per address across processes; only the request that
 * gets past the cooldown inserts a row and sends mail.
 *
 * A resend appends: older links stay usable until their own expiry, so another
 * tab or a request from a different IP cannot invalidate a form already open.
 */
export async function requestOwnerSignup(
  email: string
): Promise<void> {
  const token = randomId(32);
  const tokenHash = sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL.OWNER_SIGNUP);
  const resendAfter = new Date(now.getTime() + SIGNUP_RESEND_COOLDOWN);

  const issued = await prisma.$transaction(async (tx) => {
    // hashtextextended gives a stable bigint key for this normalized address.
    // Try, do not wait: a concurrent request for the same email already owns
    // the decision, and blocking here would hold a pooled connection while the
    // loser has nothing useful to do. The generic 202 is the same either way.
    // The transaction-scoped lock releases on commit or rollback.
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${email}, 0)) AS locked
    `;

    if (!lock?.locked) return false;

    // An account already owns this address. Retire every outstanding link (none
    // could complete anyway) and answer exactly like any other request.
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      await tx.ownerSignupChallenge.deleteMany({ where: { email } });
      return false;
    }

    const latest = await tx.ownerSignupChallenge.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
      select: { resendAfter: true },
    });

    if (latest && latest.resendAfter.getTime() > now.getTime()) return false;

    const created = await tx.ownerSignupChallenge.createMany({
      data: [{ email, tokenHash, expiresAt, resendAfter }],
      skipDuplicates: true,
    });

    // A digest collision writes nothing and sends nothing; 32 random bytes make
    // this practically impossible, but the caller still needs the same answer.
    if (created.count === 0) return false;

    // Old links are left alone; only already-expired rows for this address are
    // removed so the table does not accumulate past attempts.
    await tx.ownerSignupChallenge.deleteMany({
      where: { email, expiresAt: { lte: now } },
    });

    return true;
  });

  if (!issued) return;

  scheduleDelivery(email, token, expiresAt);
  scheduleExpiredCleanup();
}

/** Read-only: preview never writes, sets cookies, or looks up an account. */
export async function previewOwnerSignup(
  rawToken: string
): Promise<OwnerSignupPreview> {
  const challenge = await prisma.ownerSignupChallenge.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: { email: true, expiresAt: true },
  });

  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
    throw new AppError(INVALID_SIGNUP_LINK, HTTP_STATUS.BAD_REQUEST);
  }

  return { email: challenge.email };
}

// Detached from the request: the provider's latency or failure must not appear
// in the 202. The slot keeps its cooldown either way, so the owner can request
// a fresh link after a minute.
function scheduleDelivery(email: string, token: string, expiresAt: Date): void {
  void (async () => {
    const signupUrl = `${ENV.APP_URL}/signup/complete#token=${encodeURIComponent(token)}`;

    await sendSignupEmail({
      to: email,
      ...buildOwnerSignupEmail({ signupUrl, expiresAt }),
    });
  })().catch(() => {
    // Fixed message: no address, token, digest or raw provider error.
    console.error("Owner signup email could not be delivered");
  });
}

// Bounded and best effort: expired rows are already unusable, so this only
// keeps the table from growing during idle periods.
function scheduleExpiredCleanup(): void {
  void (async () => {
    const cutoff = new Date();
    const expired = await prisma.ownerSignupChallenge.findMany({
      where: { expiresAt: { lte: cutoff } },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: EXPIRED_CLEANUP_LIMIT,
    });

    if (expired.length === 0) return;

    // Repeat the cutoff in the delete predicate: between the read and this
    // statement a row could have been reissued with a later expiry.
    await prisma.ownerSignupChallenge.deleteMany({
      where: {
        id: { in: expired.map((challenge) => challenge.id) },
        expiresAt: { lte: cutoff },
      },
    });
  })().catch(() => {
    console.error("Expired owner signup challenges could not be cleaned up");
  });
}
