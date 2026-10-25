import type { MenuCategory } from "@plateflow/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";

// A duplicate name arrives as a field-scoped 409 so the client maps it onto the
// name input. Reused by the pre-check and by the P2002 backstop below.
const duplicateNameError = () =>
  new AppError("A category with this name already exists", HTTP_STATUS.CONFLICT, true, [
    { field: "name", message: "A category with this name already exists" },
  ]);


const notFoundError = () =>
  new AppError("Menu category not found", HTTP_STATUS.NOT_FOUND);

const withItemCount = {
  _count: { select: { items: true } },
} as const;

type CategoryWithCount = {
  id: string;
  name: string;
  _count: { items: number };
};

const toMenuCategory = (category: CategoryWithCount): MenuCategory => ({
  id: category.id,
  name: category.name,
  itemCount: category._count.items,
});

class MenuCategoryService {
  async list(restaurantId: string): Promise<MenuCategory[]> {
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { name: "asc" },
      include: withItemCount,
    });

    return categories.map(toMenuCategory);
  }

  async create(restaurantId: string, name: string): Promise<MenuCategory> {
    await this.assertNameAvailable(restaurantId, name);

    const created = await this.runUnique(() =>
      prisma.menuCategory.create({
        data: { name, restaurantId },
        include: withItemCount,
      })
    );

    return toMenuCategory(created);
  }

  async update(
    restaurantId: string,
    id: string,
    name: string
  ): Promise<MenuCategory> {
    await this.assertExists(restaurantId, id);
    await this.assertNameAvailable(restaurantId, name, id);

    const updated = await this.runUnique(() =>
      prisma.menuCategory.update({
        where: { id, restaurantId },
        data: { name },
        include: withItemCount,
      })
    );

    return toMenuCategory(updated);
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId },
      include: withItemCount,
    });

    if (!category) {
      throw notFoundError();
    }

    // MenuItem.categoryId is required, so deleting a category that still has
    // items would orphan them at the database level. Refuse instead and tell
    // the caller what has to happen first.
    if (category._count.items > 0) {
      throw new AppError(
        "Move or remove this category's items before deleting it",
        HTTP_STATUS.CONFLICT
      );
    }

    const { count } = await prisma.menuCategory.deleteMany({
      where: { id, restaurantId },
    });
    if (count === 0) throw notFoundError();
  }

  private async assertExists(restaurantId: string, id: string): Promise<void> {
    const existing = await prisma.menuCategory.findFirst({
      where: { id, restaurantId },
      select: { id: true },
    });

    if (!existing) {
      throw notFoundError();
    }
  }

  // Case-insensitive so "Drinks" and "drinks" cannot both exist in one
  // restaurant. `exceptId` lets an update keep its own name. The field-scoped
  // error maps straight onto the name input on the client.
  private async assertNameAvailable(
    restaurantId: string,
    name: string,
    exceptId?: string
  ): Promise<void> {
    const clash = await prisma.menuCategory.findFirst({
      where: {
        restaurantId,
        name: { equals: name, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });

    if (clash) {
      throw duplicateNameError();
    }
  }

  // The DB's unique index on name is the real guard; the pre-check above only
  // wins the common case with a nicer message. This turns the index's P2002
  // (a duplicate that slipped through a race or double-submit) into the same
  // field-scoped error instead of the generic conflict.
  private async runUnique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw duplicateNameError();
      }
      throw error;
    }
  }
}

export default new MenuCategoryService();
