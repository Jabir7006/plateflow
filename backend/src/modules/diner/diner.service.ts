import type { TableMenu } from "@plateflow/shared";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";
import menuItemService from "../menu-item/menu-item.service.js";

class DinerService {
  // Resolves a scanned QR token to its table, then returns the menu a diner may
  // see. An unknown token (garbage, or one that was regenerated and so no longer
  // exists) 404s rather than falling back to the global menu — that's what makes
  // a rotated sticker actually stop working.
  async getTableMenu(token: string): Promise<TableMenu> {
    const table = await prisma.table.findUnique({
      where: { qrCode: token }, // qrCode is @unique, so this is indexed.
      select: { number: true, restaurantId: true },
    });

    // An unknown code 404s rather than falling back to any menu: the token is the
    // only tenant anchor on this public path.
    if (!table) {
      throw new AppError(
        "This code isn't valid. Ask a member of staff for help.",
        HTTP_STATUS.NOT_FOUND
      );
    }

    // The availability filter lives in the menu service so staff and diner
    // views share one query and one shape. The token's restaurant is the tenant,
    // so a diner only ever sees the menu of the restaurant they are sitting in.
    const items = await menuItemService.list(table.restaurantId, {
      availableOnly: true,
    });

    return { table: { number: table.number }, items };
  }
}

export default new DinerService();
