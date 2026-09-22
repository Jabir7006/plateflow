import type {
  CreateMenuItemSchema,
  ListMenuItemsSchema,
  MenuItem,
  UpdateMenuItemSchema,
} from "@plateflow/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { deleteImage, replaceImage } from "../../lib/image-storage.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";

type CreateInput = CreateMenuItemSchema["body"];
type UpdateInput = UpdateMenuItemSchema["body"];
// `availableOnly` is not a query param staff send — it's how the public diner
// menu asks for only what it may show. Kept off the wire schema on purpose.
type ListInput = ListMenuItemsSchema["query"] & { availableOnly?: boolean };

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

const itemInclude = {
  category: { select: { name: true } },
  sizes: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.MenuItemInclude;

// Array order is the display order; sortOrder persists it.
const toSizeCreate = (list: { label: string; price: number }[]) =>
  list.map((size, index) => ({
    label: size.label,
    price: size.price,
    sortOrder: index,
  }));

// A menu card is read on a phone, so 1200px covers it at 3x density without
// sending pixels no screen will show.
const IMAGE_MAX_EDGE_PX = 1200;
const IMAGE_FOLDER = "plateflow/menu-items";

type ItemRow = Prisma.MenuItemGetPayload<{ include: typeof itemInclude }>;

const toMenuItem = (item: ItemRow): MenuItem => {
  const sizes = item.sizes.map((size) => ({
    id: size.id,
    label: size.label,
    // The column holds 2 decimals, so Decimal -> number is lossless here and the
    // value round-trips through JSON unchanged. Totals are summed in the
    // database for the same reason: floating point is not money.
    price: size.price.toNumber(),
  }));

  return {
    id: item.id,
    name: item.name,
    // When the item has sizes, `price` is the "from" price shown on the menu:
    // the cheapest size, derived here rather than trusting the stored column,
    // which staff can leave stale (sizes go in any order, no reorder UI).
    price: sizes.length
      ? Math.min(...sizes.map((size) => size.price))
      : item.price.toNumber(),
    description: item.description,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    sizes,
  };
};

class MenuItemService {
  // Unavailable items are included by default on purpose: staff have to see and
  // flip them. The diner menu passes `availableOnly` to get just what it may
  // show, so the availability rule lives here rather than being re-derived.
  async list({ categoryId, availableOnly }: ListInput = {}): Promise<
    MenuItem[]
  > {
    const items = await prisma.menuItem.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(availableOnly ? { isAvailable: true } : {}),
      },
      // Ordered by category so the list reads the way a menu does.
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: itemInclude,
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
            ...(input.sizes?.length
              ? { sizes: { create: toSizeCreate(input.sizes) } }
              : {}),
          },
          include: itemInclude,
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
      // Sizes are replaced as a set: clear the old rows and recreate from the
      // sent order. Only touched when the caller included the field, so a PATCH
      // that omits it leaves existing sizes alone. Safe to delete freely while
      // orders don't reference sizes yet.
      ...(input.sizes !== undefined && {
        sizes: {
          deleteMany: {},
          create: toSizeCreate(input.sizes),
        },
      }),
    };

    const updated = await this.runWrite(
      () =>
        prisma.menuItem.update({
          where: { id },
          data,
          include: itemInclude,
        }),
      unknownCategoryError
    );

    return toMenuItem(updated);
  }

  async setImage(id: string, file: Buffer): Promise<MenuItem> {
    // Read before uploading, so a wrong id does not cost a stored image.
    const existing = await this.assertExists(id);

    const updated = await replaceImage({
      target: {
        folder: IMAGE_FOLDER,
        name: id,
        maxEdgePx: IMAGE_MAX_EDGE_PX,
      },
      file,
      previousPublicId: existing.imagePublicId,
      save: (image) =>
        prisma.menuItem.update({
          where: { id },
          data: { imageUrl: image.url, imagePublicId: image.publicId },
          include: itemInclude,
        }),
    });

    return toMenuItem(updated);
  }

  /** Removes the item's photo, if it has one. */
  async clearImage(id: string): Promise<MenuItem> {
    const existing = await this.assertExists(id);

    // Written unconditionally: clearing an image that is already absent is the
    // outcome the caller asked for, so it answers with the item rather than 404.
    // The delete below removes the public id read before this write, so a replace
    // that lands in between is the accepted race setImage documents.
    const updated = await prisma.menuItem.update({
      where: { id },
      data: { imageUrl: null, imagePublicId: null },
      include: itemInclude,
    });

    if (existing.imagePublicId) {
      await deleteImage(existing.imagePublicId);
    }

    return toMenuItem(updated);
  }

  async remove(id: string): Promise<void> {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: {
        id: true,
        imagePublicId: true,
        _count: { select: { orderItems: true } },
      },
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

    // After the row, never before: a failed delete must not remove the photo
    // the item still points at.
    // The id is the one read before the delete, so a replace that lands in
    // between is the accepted race setImage documents; the delete's own
    // returning clause holds what the row actually had.
    if (item.imagePublicId) {
      await deleteImage(item.imagePublicId);
    }
  }

  // The public id comes back with the check, so the image routes need no
  // second read of the row.
  private async assertExists(
    id: string
  ): Promise<{ imagePublicId: string | null }> {
    const existing = await prisma.menuItem.findUnique({
      where: { id },
      select: { id: true, imagePublicId: true },
    });

    if (!existing) {
      throw notFoundError();
    }

    return existing;
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
