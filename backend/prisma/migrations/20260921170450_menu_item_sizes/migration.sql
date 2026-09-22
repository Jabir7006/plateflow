-- CreateTable
CREATE TABLE "MenuItemSize" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItemSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemSize_menuItemId_idx" ON "MenuItemSize"("menuItemId");

-- AddForeignKey
ALTER TABLE "MenuItemSize" ADD CONSTRAINT "MenuItemSize_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
