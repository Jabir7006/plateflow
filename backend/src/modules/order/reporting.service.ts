import type { OrderReportRange } from "@plateflow/shared";
import { prisma } from "../../lib/prisma.js";
import {
  isValidTimeZone,
  resolveReportingPeriod,
} from "../../lib/reporting-period.js";
import { reportingClock } from "../../lib/reporting-clock.js";
import AppError from "../../utils/AppError.js";
import { HTTP_STATUS } from "../../constants/http.js";

export async function getReportingPeriod(
  restaurantId: string,
  range: OrderReportRange
) {
  // The signed session's tenant selects its own root record. A client cannot
  // supply or override the timezone used to interpret restaurant calendar days.
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timeZone: true },
  });
  if (!restaurant)
    throw new AppError("Restaurant not found", HTTP_STATUS.NOT_FOUND);
  if (!isValidTimeZone(restaurant.timeZone)) {
    throw new AppError(
      "Restaurant reporting timezone needs correction. Contact the restaurant owner or support.",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
  return resolveReportingPeriod(
    restaurant.timeZone,
    range,
    reportingClock.now()
  );
}
