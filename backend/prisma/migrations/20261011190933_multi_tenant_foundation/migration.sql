-- Tenant columns stay nullable until every writer supplies restaurantId.

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- Seed the default restaurant that every pre-existing row will belong to. The
-- seed script upserts this same slug, so re-seeding stays idempotent.
INSERT INTO "Restaurant" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('default_restaurant', 'My Restaurant', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Expand: add restaurantId to every tenant table, nullable for now.
ALTER TABLE "User" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "MenuCategory" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "Table" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "restaurantId" TEXT;

-- Backfill: fold existing single-tenant data into the default restaurant.
UPDATE "User" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "MenuCategory" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "MenuItem" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "Table" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "Order" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;

-- DropIndex: table number and category name uniqueness becomes per-restaurant.
DROP INDEX "Table_number_key";
DROP INDEX "MenuCategory_name_key";

-- DropIndex: the order reporting indexes are replaced by restaurant-scoped ones.
DROP INDEX "Order_createdAt_idx";
DROP INDEX "Order_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "User_restaurantId_idx" ON "User"("restaurantId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE UNIQUE INDEX "MenuCategory_restaurantId_name_key" ON "MenuCategory"("restaurantId", "name");
CREATE UNIQUE INDEX "Table_restaurantId_number_key" ON "Table"("restaurantId", "number");
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");
CREATE INDEX "Order_restaurantId_status_createdAt_idx" ON "Order"("restaurantId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
