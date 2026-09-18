import type {
  CreateMenuCategorySchema,
  MenuCategoryIdSchema,
  UpdateMenuCategorySchema,
} from "@plateflow/shared";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import menuCategoryService from "./menu-category.service.js";

export const listMenuCategories = catchAsync(async (_req, res) => {
  const categories = await menuCategoryService.list();
  sendResponse(res, HTTP_STATUS.SUCCESS, categories);
});

export const createMenuCategory = catchAsync(async (req, res) => {
  // Already parsed by `validate(createMenuCategorySchema)`, which trims `name`.
  const { name } = req.body as CreateMenuCategorySchema["body"];
  const category = await menuCategoryService.create(name);
  sendResponse(res, HTTP_STATUS.CREATED, category, "Category created");
});

export const updateMenuCategory = catchAsync(async (req, res) => {
  const { id } = req.params as UpdateMenuCategorySchema["params"];
  const { name } = req.body as UpdateMenuCategorySchema["body"];
  const category = await menuCategoryService.update(id, name);
  sendResponse(res, HTTP_STATUS.SUCCESS, category, "Category updated");
});

export const deleteMenuCategory = catchAsync(async (req, res) => {
  const { id } = req.params as MenuCategoryIdSchema["params"];
  await menuCategoryService.remove(id);
  sendResponse(res, HTTP_STATUS.SUCCESS, null, "Category deleted");
});
