-- Allow several outstanding links per address. A resend adds a row instead of
-- rewriting the only slot, so a link already open in a form keeps working.
DROP INDEX "OwnerSignupChallenge_email_key";

ALTER TABLE "OwnerSignupChallenge"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "OwnerSignupChallenge_email_idx" ON "OwnerSignupChallenge"("email");
