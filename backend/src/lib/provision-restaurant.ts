import type { Prisma } from "../generated/prisma/client.js";

// The one write path that creates a tenant and its first OWNER together. Both
// the operator CLI and self-serve signup call this inside their own transaction
// so a failure halfway never leaves a restaurant without an owner (or the
// reverse). Callers keep their own validation, password hashing and output.
export interface CreateRestaurantWithOwnerInput {
  name: string;
  slug: string;
  timeZone: string;
  ownerName: string;
  ownerEmail: string;
  passwordHash: string;
}

export async function createRestaurantWithOwner(
  tx: Prisma.TransactionClient,
  { name, slug, timeZone, ownerName, ownerEmail, passwordHash }: CreateRestaurantWithOwnerInput
) {
  const restaurant = await tx.restaurant.create({
    data: { name, slug, timeZone },
  });

  const owner = await tx.user.create({
    data: {
      fullName: ownerName,
      email: ownerEmail,
      password: passwordHash,
      role: "OWNER",
      status: "ACTIVE",
      // The account is created in the same transaction as its tenant, so the
      // id below is the row that just committed, never a caller-supplied value.
      restaurantId: restaurant.id,
    },
  });

  return { restaurant, owner };
}
