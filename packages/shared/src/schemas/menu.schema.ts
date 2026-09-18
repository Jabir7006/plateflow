import { z } from "zod";

const displayName = (label: string, maxLength: number) =>
  z
    .string(`${label} is required`)
    .trim()
    .min(2, `${label} is too short`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer`);

const requiredId = (label: string) =>
  z.string(`${label} id is required`).trim().min(1, `${label} id is required`);

const categoryName = displayName("Category name", 60);
const categoryParamId = requiredId("Category");
const itemName = displayName("Item name", 80);
const itemParamId = requiredId("Item");

const categoryId = z
  .string("Category is required")
  .trim()
  .min(1, "Category is required");

// A sanity ceiling on typos, well inside the column's Decimal(10,2) range.
const MAX_PRICE = 1_000_000;

// A plain decimal with at most 2 decimals. Number() would also happily read
// "0x1F", "1e5" and "12,50"; none of those is a price.
const PLAIN_DECIMAL = /^\d{1,7}(\.\d{1,2})?$/;

// A price reaches the API as a JSON number and the web form as the raw text of
// an input, so both are normalised to a number before the shared rules run.
// The rules are what matter: positive, at most 2 decimals (money), bounded.
const price = z
  .union([z.number(), z.string().trim().min(1)], "Price is required")
  .transform((value) => {
    if (typeof value === "number") return value;
    const raw = value.trim();
    return PLAIN_DECIMAL.test(raw) ? Number(raw) : Number.NaN;
  })
  .pipe(
    z
      .number("Enter a valid price, for example 250 or 250.50")
      .positive("Price must be greater than 0")
      .multipleOf(0.01, "Price can have at most 2 decimal places")
      .max(MAX_PRICE, "Price looks too large"),
  );

const description = z
  .string("Description must be text")
  .trim()
  .max(300, "Description must be 300 characters or fewer")
  .transform((value) => (value === "" ? null : value))
  .nullish();

const isAvailable = z.boolean("Availability must be true or false");

export const createMenuCategorySchema = z.object({
  body: z.object({ name: categoryName }),
});

export const updateMenuCategorySchema = z.object({
  params: z.object({ id: categoryParamId }),
  body: z.object({ name: categoryName }),
});

export const menuCategoryIdSchema = z.object({
  params: z.object({ id: categoryParamId }),
});

export const createMenuItemSchema = z.object({
  body: z.object({
    name: itemName,
    price,
    description,
    categoryId,
    // Optional on purpose: a new item is available unless the caller says
    // otherwise, matching the column default.
    isAvailable: isAvailable.optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({ id: itemParamId }),
  body: z
    .object({
      name: itemName.optional(),
      price: price.optional(),
      description,
      categoryId: categoryId.optional(),
      isAvailable: isAvailable.optional(),
    })
    // A PATCH that names no field is a client bug rather than a no-op, so it is
    // reported instead of silently touching the row.
    .refine(
      (body) => Object.values(body).some((value) => value !== undefined),
      {
        message: "Provide at least one field to update",
      },
    ),
});

export const menuItemIdSchema = z.object({
  params: z.object({ id: itemParamId }),
});

export const listMenuItemsSchema = z.object({
  query: z.object({
    // An empty `?categoryId=` means "every category" rather than a bad id.
    categoryId: z
      .string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  }),
});

export type CreateMenuCategorySchema = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategorySchema = z.infer<typeof updateMenuCategorySchema>;
export type MenuCategoryIdSchema = z.infer<typeof menuCategoryIdSchema>;
export type CreateMenuItemSchema = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemSchema = z.infer<typeof updateMenuItemSchema>;
export type MenuItemIdSchema = z.infer<typeof menuItemIdSchema>;
export type ListMenuItemsSchema = z.infer<typeof listMenuItemsSchema>;
