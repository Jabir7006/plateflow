import type {
  CreateMenuItemSchema,
  ListMenuItemsSchema,
  MenuItemIdSchema,
  UpdateMenuItemSchema,
} from "@plateflow/shared";
import catchAsync from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../constants/http.js";
import {
  MENU_ITEM_IMAGE_FIELD,
  requireImageFile,
} from "../../middlewares/upload.middleware.js";
import menuItemService from "./menu-item.service.js";

export const listMenuItems = catchAsync(async (req, res) => {
  // Already parsed by `validate(listMenuItemsSchema)`, which ignores unknown
  // query keys and treats an empty `categoryId` as "every category".
  const { categoryId } = req.query as ListMenuItemsSchema["query"];
  const items = await menuItemService.list({ categoryId });
  sendResponse(res, HTTP_STATUS.SUCCESS, items);
});

export const createMenuItem = catchAsync(async (req, res) => {
  // Already parsed by `validate(createMenuItemSchema)`, which trims the text
  // fields and normalises the price to a number.
  const input = req.body as CreateMenuItemSchema["body"];
  const item = await menuItemService.create(input);
  sendResponse(res, HTTP_STATUS.CREATED, item, "Menu item created");
});

export const updateMenuItem = catchAsync(async (req, res) => {
  const { id } = req.params as UpdateMenuItemSchema["params"];
  const input = req.body as UpdateMenuItemSchema["body"];
  const item = await menuItemService.update(id, input);
  sendResponse(res, HTTP_STATUS.SUCCESS, item, "Menu item updated");
});

export const deleteMenuItem = catchAsync(async (req, res) => {
  const { id } = req.params as MenuItemIdSchema["params"];
  await menuItemService.remove(id);
  sendResponse(res, HTTP_STATUS.SUCCESS, null, "Menu item deleted");
});

export const updateMenuItemImage = catchAsync(async (req, res) => {
  const { id } = req.params as MenuItemIdSchema["params"];
  // The multipart body is already parsed by `menuItemImageUpload`, so this only
  // asserts that a file arrived with it.
  const item = await menuItemService.setImage(
    id,
    requireImageFile(req, MENU_ITEM_IMAGE_FIELD)
  );
  sendResponse(res, HTTP_STATUS.SUCCESS, item, "Menu item image updated");
});

export const removeMenuItemImage = catchAsync(async (req, res) => {
  const { id } = req.params as MenuItemIdSchema["params"];
  const item = await menuItemService.clearImage(id);
  sendResponse(res, HTTP_STATUS.SUCCESS, item, "Menu item image removed");
});
