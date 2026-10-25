import type { Table } from "@plateflow/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { randomId } from "../../utils/crypto.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";

// A duplicate number arrives as a field-scoped 409 so the client maps it onto
// the number input. Reused by the pre-check and by the P2002 backstop below.
const duplicateNumberError = () =>
  new AppError("A table with this number already exists", HTTP_STATUS.CONFLICT, true, [
    { field: "number", message: "A table with this number already exists" },
  ]);

const withOrderCount = {
  _count: { select: { orders: true } },
} as const;

type TableWithCount = {
  id: string;
  number: number;
  qrCode: string;
  _count: { orders: number };
};

const toTable = (table: TableWithCount): Table => ({
  id: table.id,
  number: table.number,
  qrCode: table.qrCode,
  orderCount: table._count.orders,
});

const notFoundError = () =>
  new AppError("Table not found", HTTP_STATUS.NOT_FOUND);

class TableService {
  async list(restaurantId: string): Promise<Table[]> {
    const tables = await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { number: "asc" },
      include: withOrderCount,
    });

    return tables.map(toTable);
  }

  async create(restaurantId: string, number: number): Promise<Table> {
    await this.assertNumberAvailable(restaurantId, number);

    const created = await this.runUnique(() =>
      prisma.table.create({
        // The QR token is a high-entropy value the printed code encodes; it is
        // generated here and never supplied by the client.
        data: { number, qrCode: randomId(), restaurantId },
        include: withOrderCount,
      })
    );

    return toTable(created);
  }

  async update(restaurantId: string, id: string, number: number): Promise<Table> {
    await this.assertExists(restaurantId, id);
    await this.assertNumberAvailable(restaurantId, number, id);

    // updateMany rather than update: the tenant rides the write itself, so a row
    // deleted or reassigned between the checks above can't be touched.
    const updated = await this.runUnique(async () => {
      const { count } = await prisma.table.updateMany({
        where: { id, restaurantId },
        data: { number },
      });
      if (count === 0) throw notFoundError();
      return this.loadWithCount(restaurantId, id);
    });

    return toTable(updated);
  }

  // Rotate the QR token. Used when a printed code is compromised: the new token
  // makes every existing sticker for this table dead, so it is a deliberate,
  // confirmed action on the client. A physically damaged (but uncompromised)
  // sticker should be reprinted from the same token instead, not regenerated.
  async regenerateQr(restaurantId: string, id: string): Promise<Table> {
    await this.assertExists(restaurantId, id);

    const updated = await this.runUnique(async () => {
      const { count } = await prisma.table.updateMany({
        where: { id, restaurantId },
        data: { qrCode: randomId() },
      });
      if (count === 0) throw notFoundError();
      return this.loadWithCount(restaurantId, id);
    });

    return toTable(updated);
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
      include: withOrderCount,
    });

    if (!table) {
      throw notFoundError();
    }

    // Order.tableId references this row with ON DELETE RESTRICT, so deleting a
    // table that still has orders would fail at the database and orphan history.
    // Refuse instead and tell the caller what has to happen first.
    if (table._count.orders > 0) {
      throw new AppError(
        "This table has orders, so it can't be deleted",
        HTTP_STATUS.CONFLICT
      );
    }

    const { count } = await prisma.table.deleteMany({
      where: { id, restaurantId },
    });
    if (count === 0) throw notFoundError();
  }

  // Re-read after a scoped write: updateMany returns only a count, and the
  // response needs the order count too.
  private async loadWithCount(
    restaurantId: string,
    id: string
  ): Promise<TableWithCount> {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
      include: withOrderCount,
    });
    if (!table) throw notFoundError();
    return table;
  }

  private async assertExists(restaurantId: string, id: string): Promise<void> {
    const existing = await prisma.table.findFirst({
      where: { id, restaurantId },
      select: { id: true },
    });

    if (!existing) {
      throw notFoundError();
    }
  }

  // `exceptId` lets an update keep its own number. Numbers are unique per
  // restaurant, so this only looks within the caller's tenant.
  private async assertNumberAvailable(
    restaurantId: string,
    number: number,
    exceptId?: string
  ): Promise<void> {
    const clash = await prisma.table.findFirst({
      where: {
        restaurantId,
        number,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });

    if (clash) {
      throw duplicateNumberError();
    }
  }

  // The DB's unique indexes are the real guards; the pre-check above only wins
  // the common case with a nicer message. A P2002 on `number` (a duplicate that
  // slipped through a race or double-submit) becomes the same field-scoped
  // error. A P2002 on `qrCode` is an astronomically rare token collision — retry
  // once with a fresh token rather than failing the request.
  private async runUnique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = error.meta?.target;
        const onQrCode = Array.isArray(target)
          ? target.includes("qrCode")
          : typeof target === "string" && target.includes("qrCode");

        if (onQrCode) {
          return await write();
        }

        throw duplicateNumberError();
      }
      throw error;
    }
  }
}

export default new TableService();
