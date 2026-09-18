import type {
  CreateMenuItemSchema,
  ListMenuItemsSchema,
  MenuItem,
  UpdateMenuItemSchema,
} from "@plateflow/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";

type CreateInput = CreateMenuItemSchema["body"];
type UpdateInput = UpdateMenuItemSchema["body"];
type ListInput = ListMenuItemsSchema["query"];

const notFoundError = () =>
  new AppError("Menu item not found", HTTP_STATUS.NOT_FOUND);

// An item's category has to exist. Reported as a field-scoped error so the
// client can point at the category picker instead of showing a bare banner.
const unknownCategoryError = () =>
  new AppError("Choose an existing category", HTTP_STATUS.BAD_REQUEST, true, [
    { field: "categoryId", message: "Choose an existing category" },
  ]);

// MenuItem.categoryId is required and OrderItem references items with
// ON DELETE RESTRICT, so deleting an item that has been ordered would either
// orphan order history or fail at the database. Refuse, and name the action
// that is always open instead.
const orderedItemError = () =>
  new AppError(
    "This item appears in past orders, so it cannot be deleted. Mark it unavailable instead.",
    HTTP_STATUS.CONFLICT
  );

const withCategoryName = { category: { select: { name: true } } } as const;

type ItemRow = Prisma.MenuItemGetPayload<{ include: typeof withCategoryName }>;

const toMenuItem = (item: ItemRow): MenuItem => ({
  id: item.id,
  name: item.name,
  // The column holds 2 decimals, so Decimal -> number is lossless here and the
  // value round-trips through JSON unchanged. Totals are summed in the database
  // for the same reason: floating point is not money.
  price: item.price.toNumber(),
  description: item.description,
  imageUrl: item.imageUrl,
  isAvailable: item.isAvailable,
  categoryId: item.categoryId,
  categoryName: item.category.name,
});

class MenuItemService {
  // Unavailable items are included on purpose: staff have to see and flip them,
  // and a customer menu is expected to filter on the flag it already carries.
  async list({ categoryId }: ListInput = {}): Promise<MenuItem[]> {
    const items = await prisma.menuItem.findMany({
      where: categoryId ? { categoryId } : undefined,
      // Ordered by category so the list reads the way a menu does.
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: withCategoryName,
    });

    return items.map(toMenuItem);
  }

  async create(input: CreateInput): Promise<MenuItem> {
    await this.assertCategoryExists(input.categoryId);

    const created = await this.runWrite(
      () =>
        prisma.menuItem.create({
          data: {
            name: input.name,
            price: input.price,
            description: input.description,
            categoryId: input.categoryId,
            // Absent means available, matching the column default.
            isAvailable: input.isAvailable ?? true,
          },
          include: withCategoryName,
        }),
      unknownCategoryError
    );

    return toMenuItem(created);
  }

  async update(id: string, input: UpdateInput): Promise<MenuItem> {
    await this.assertExists(id);

    if (input.categoryId !== undefined) {
      await this.assertCategoryExists(input.categoryId);
    }

    // Only the fields the caller actually sent are written, so flipping
    // availability from a list cannot overwrite a concurrent price edit.
    const data: Prisma.MenuItemUncheckedUpdateInput = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.isAvailable !== undefined && {
        isAvailable: input.isAvailable,
      }),
    };

    const updated = await this.runWrite(
      () =>
        prisma.menuItem.update({
          where: { id },
          data,
          include: withCategoryName,
        }),
      unknownCategoryError
    );

    return toMenuItem(updated);
  }

  async remove(id: string): Promise<void> {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orderItems: true } } },
    });

    if (!item) {
      throw notFoundError();
    }

    // The count exists only to answer "has this ever been ordered?"; the read
    // model deliberately does not publish it, so no list query pays for it.
    if (item._count.orderItems > 0) {
      throw orderedItemError();
    }

    await this.runWrite(
      () => prisma.menuItem.delete({ where: { id } }),
      orderedItemError
    );
  }

  private async assertExists(id: string): Promise<void> {
    const existing = await prisma.menuItem.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw notFoundError();
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw unknownCategoryError();
    }
  }

  // The pre-checks above win the common case with a precise message. This turns
  // the foreign key violation that slips through a race (the category was
  // deleted, or the item was ordered, between the check and the write) into the
  // same error instead of the error middleware's generic 400.
  private async runWrite<T>(
    write: () => Promise<T>,
    onForeignKeyViolation: () => AppError
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw onForeignKeyViolation();
      }
      throw error;
    }
  }
}

export default new MenuItemService();
