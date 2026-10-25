-- Contract step for the tenant columns: every writer now supplies restaurantId,
-- so the nullable expand column becomes required.
--
-- Rows written by the previous commit omitted restaurantId, so a database that
-- was used since the expand migration can still hold orphans. They are handled
-- here rather than left to a manual fix discovered mid-deploy:
--
--   * one restaurant exists  -> the tenant is unambiguous, fold them in, which
--     is exactly the rule the expand step applied to the pre-tenant rows.
--   * several restaurants     -> there is no way to tell which tenant an orphan
--     belongs to, so abort with an actionable message instead of guessing.
--
-- Both branches are no-ops on a clean database, so this is safe to re-run.

DO $$
DECLARE
  orphan_tables text;
  orphan_count  bigint := 0;
  restaurant_count bigint;
BEGIN
  SELECT count(*) INTO restaurant_count FROM "Restaurant";

  SELECT
    string_agg(format('%s=%s', table_name, null_count), ', ' ORDER BY table_name),
    sum(null_count)
  INTO orphan_tables, orphan_count
  FROM (
    SELECT 'User' AS table_name, count(*) AS null_count
      FROM "User" WHERE "restaurantId" IS NULL
    UNION ALL
    SELECT 'MenuCategory', count(*) FROM "MenuCategory" WHERE "restaurantId" IS NULL
    UNION ALL
    SELECT 'MenuItem', count(*) FROM "MenuItem" WHERE "restaurantId" IS NULL
    UNION ALL
    SELECT 'Table', count(*) FROM "Table" WHERE "restaurantId" IS NULL
    UNION ALL
    SELECT 'Order', count(*) FROM "Order" WHERE "restaurantId" IS NULL
  ) AS orphans
  WHERE null_count > 0
  HAVING sum(null_count) > 0;

  IF orphan_count = 0 THEN
    RETURN;
  END IF;

  IF restaurant_count > 1 THEN
    RAISE EXCEPTION
      'Cannot make restaurantId required: % row(s) have no tenant (%), and this database has % restaurants, so their owner is ambiguous. Assign them explicitly, then re-run the migration.',
      orphan_count, orphan_tables, restaurant_count;
  END IF;

  IF restaurant_count = 0 THEN
    RAISE EXCEPTION
      'Cannot make restaurantId required: % row(s) have no tenant (%) and no restaurant exists to assign them to.',
      orphan_count, orphan_tables;
  END IF;

  UPDATE "User" SET "restaurantId" = (SELECT id FROM "Restaurant" LIMIT 1)
    WHERE "restaurantId" IS NULL;
  UPDATE "MenuCategory" SET "restaurantId" = (SELECT id FROM "Restaurant" LIMIT 1)
    WHERE "restaurantId" IS NULL;
  UPDATE "MenuItem" SET "restaurantId" = (SELECT id FROM "Restaurant" LIMIT 1)
    WHERE "restaurantId" IS NULL;
  UPDATE "Table" SET "restaurantId" = (SELECT id FROM "Restaurant" LIMIT 1)
    WHERE "restaurantId" IS NULL;
  UPDATE "Order" SET "restaurantId" = (SELECT id FROM "Restaurant" LIMIT 1)
    WHERE "restaurantId" IS NULL;

  RAISE NOTICE 'Assigned % orphan row(s) to the only restaurant (%): %',
    orphan_count, (SELECT id FROM "Restaurant" LIMIT 1), orphan_tables;
END $$;

ALTER TABLE "User" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "MenuCategory" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "MenuItem" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "Table" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "restaurantId" SET NOT NULL;
