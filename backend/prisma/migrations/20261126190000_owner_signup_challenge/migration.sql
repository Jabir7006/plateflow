-- Pre-tenant owner signup: a challenge proves an email before any user or
-- restaurant row exists, so there are no foreign keys and no backfill.
-- CreateTable
CREATE TABLE "OwnerSignupChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerSignupChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerSignupChallenge_email_key" ON "OwnerSignupChallenge"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerSignupChallenge_tokenHash_key" ON "OwnerSignupChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "OwnerSignupChallenge_expiresAt_idx" ON "OwnerSignupChallenge"("expiresAt");
