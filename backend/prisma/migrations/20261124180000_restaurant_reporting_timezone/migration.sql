-- Preserve the deployed UTC reporting convention for existing restaurants.
-- Operators must verify each restaurant's actual zone before production rollout.
-- Order timestamps are instants and must never be rewritten for this change.
ALTER TABLE "Restaurant" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC';
