import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  api,
  db,
  login,
  provisionRestaurant,
  removeFixtures,
  removeIssuedRefreshTokens,
  startServer,
  type Provisioned,
  type Session,
  type TestServer,
} from "../harness.js";

// Menu and table management: the write paths staff use every day, plus the
// public reader that must only show what is available.

let server: TestServer;
let request: ReturnType<typeof api>;
let restaurant: Provisioned;
let session: Session;
let baseCategory: { id: string; name: string };

const json = (method: string, body: unknown, headers: Record<string, string>) => ({
  method,
  headers,
  body: JSON.stringify(body),
});

async function createCategory(name: string) {
  const { body } = await request("/api/v1/menu/categories", {
    ...json("POST", { name }, session.headers),
    expect: 201,
  });
  return body.data as { id: string; name: string; itemCount: number };
}

async function createItem(input: Record<string, unknown>) {
  const { body } = await request("/api/v1/menu/items", {
    ...json("POST", input, session.headers),
    expect: 201,
  });
  return body.data as {
    id: string;
    name: string;
    price: number;
    description: string | null;
    isAvailable: boolean;
    categoryId: string;
    categoryName: string;
    sizes: { id: string; label: string; price: number }[];
  };
}

async function listItems(query = "") {
  const { body } = await request(`/api/v1/menu/items${query}`, {
    headers: session.headers,
  });
  return body.data as { id: string; name: string; isAvailable: boolean }[];
}

async function createTable(number: number) {
  const { body } = await request("/api/v1/tables", {
    ...json("POST", { number }, session.headers),
    expect: 201,
  });
  return body.data as { id: string; number: number; qrCode: string; orderCount: number };
}

async function listTables() {
  const { body } = await request("/api/v1/tables", { headers: session.headers });
  return body.data as { id: string; number: number; qrCode: string }[];
}

async function placeOrder(tableToken: string, menuItemId: string, quantity = 1) {
  const { body } = await request(`/api/v1/t/${tableToken}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ menuItemId, quantity }] }),
    expect: 201,
  });
  return body.data.id as string;
}

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);
  restaurant = await provisionRestaurant("Menu Management");
  session = await login(request, restaurant.email, restaurant.password);
  baseCategory = await createCategory("Base");
});

afterAll(async () => {
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("categories", () => {
  it("trims the name and reports the item count", async () => {
    const category = await createCategory("  Starters  ");

    expect(category.name).toBe("Starters");
    expect(category.itemCount).toBe(0);
  });

  it("keeps the list sorted by name", async () => {
    const prefix = `sort-${Date.now()}`;
    await createCategory(`AAA ${prefix}`);
    await createCategory(`ZZZ ${prefix}`);

    const { body } = await request("/api/v1/menu/categories", {
      headers: session.headers,
    });
    const names = body.data.map((category: { name: string }) => category.name);

    expect(names.indexOf(`AAA ${prefix}`)).toBeLessThan(
      names.indexOf(`ZZZ ${prefix}`)
    );
  });

  it("rejects a duplicate name regardless of case", async () => {
    await createCategory("Drinks");

    const { body } = await request("/api/v1/menu/categories", {
      ...json("POST", { name: "drinks" }, session.headers),
      expect: 409,
    });

    expect(body.message).toBe("A category with this name already exists");
    expect(body.errors[0].field).toBe("name");
  });

  it("renames a category but will not let two names collide", async () => {
    const category = await createCategory("Hot Drinks");
    await createCategory("Cold Drinks");

    const renamed = await request(`/api/v1/menu/categories/${category.id}`, {
      ...json("PATCH", { name: "  Tea & Coffee  " }, session.headers),
    });
    expect(renamed.body.data.name).toBe("Tea & Coffee");

    await request(`/api/v1/menu/categories/${category.id}`, {
      ...json("PATCH", { name: "cold drinks" }, session.headers),
      expect: 409,
    });
  });

  it("refuses to delete a category that still has items", async () => {
    const category = await createCategory("Delete Guard");
    const item = await createItem({
      name: "Guard Soup",
      price: 5,
      categoryId: category.id,
    });

    const blocked = await request(`/api/v1/menu/categories/${category.id}`, {
      method: "DELETE",
      headers: session.headers,
      expect: 409,
    });
    expect(blocked.body.message).toMatch(/move or remove this category's items/i);

    await request(`/api/v1/menu/items/${item.id}`, {
      method: "DELETE",
      headers: session.headers,
    });
    await request(`/api/v1/menu/categories/${category.id}`, {
      method: "DELETE",
      headers: session.headers,
    });
  });
});

describe("menu items", () => {
  it("stores sizes in display order and advertises the cheapest price", async () => {
    const item = await createItem({
      name: "Sized Pizza",
      price: 12,
      categoryId: baseCategory.id,
      sizes: [
        { label: "Large", price: 15 },
        { label: "Small", price: 8 },
      ],
    });

    expect(item.price).toBe(8);
    expect(item.sizes.map((size) => size.label)).toEqual(["Large", "Small"]);
    expect(item.categoryName).toBe("Base");
    expect(item.isAvailable).toBe(true);
  });

  it("normalises a decimal-string price", async () => {
    const item = await createItem({
      name: "String Price",
      price: " 12.50 ",
      categoryId: baseCategory.id,
    });

    expect(item.price).toBe(12.5);
  });

  it("rejects an invalid price with a field-scoped error", async () => {
    const zero = await request("/api/v1/menu/items", {
      ...json(
        "POST",
        { name: "Free Soup", price: 0, categoryId: baseCategory.id },
        session.headers
      ),
      expect: 400,
    });
    expect(zero.body.errors[0].field).toBe("body.price");
    expect(zero.body.errors[0].message).toBe("Price must be greater than 0");

    const precise = await request("/api/v1/menu/items", {
      ...json(
        "POST",
        { name: "Precise Soup", price: 12.345, categoryId: baseCategory.id },
        session.headers
      ),
      expect: 400,
    });
    expect(precise.body.errors[0].message).toBe(
      "Price can have at most 2 decimal places"
    );
  });

  it("will not file an item under a category it cannot see", async () => {
    const before = await listItems();

    const { body } = await request("/api/v1/menu/items", {
      ...json(
        "POST",
        { name: "Orphan", price: 5, categoryId: "category_does_not_exist" },
        session.headers
      ),
      expect: 400,
    });
    expect(body.errors[0].field).toBe("categoryId");

    expect(await listItems()).toHaveLength(before.length);
  });

  it("updates only the fields sent", async () => {
    const item = await createItem({
      name: "Patchable",
      price: 20,
      categoryId: baseCategory.id,
      sizes: [
        { label: "S", price: 10 },
        { label: "L", price: 30 },
      ],
    });

    const priced = await request(`/api/v1/menu/items/${item.id}`, {
      ...json("PATCH", { price: 25 }, session.headers),
    });
    expect(priced.body.data.price).toBe(10); // cheapest size still wins
    expect(priced.body.data.sizes).toHaveLength(2);

    const resized = await request(`/api/v1/menu/items/${item.id}`, {
      ...json("PATCH", { sizes: [{ label: "XL", price: 40 }] }, session.headers),
    });
    expect(resized.body.data.sizes.map((size: { label: string }) => size.label)).toEqual([
      "XL",
    ]);
    expect(resized.body.data.price).toBe(40);

    const unsized = await request(`/api/v1/menu/items/${item.id}`, {
      ...json("PATCH", { sizes: [] }, session.headers),
    });
    expect(unsized.body.data.sizes).toEqual([]);
    expect(unsized.body.data.price).toBe(25);
  });

  it("rejects a PATCH that changes nothing", async () => {
    const item = await createItem({
      name: "Untouched",
      price: 6,
      categoryId: baseCategory.id,
    });

    const { body } = await request(`/api/v1/menu/items/${item.id}`, {
      ...json("PATCH", {}, session.headers),
      expect: 400,
    });

    expect(body.errors[0].message).toBe("Provide at least one field to update");
  });

  it("filters by category, treating an empty filter as all categories", async () => {
    const left = await createCategory("Filter Left");
    const right = await createCategory("Filter Right");
    const leftItem = await createItem({
      name: "Left Item",
      price: 3,
      categoryId: left.id,
    });
    const rightItem = await createItem({
      name: "Right Item",
      price: 4,
      categoryId: right.id,
    });

    const onlyLeft = await listItems(`?categoryId=${left.id}`);
    expect(onlyLeft.map((item) => item.id)).toContain(leftItem.id);
    expect(onlyLeft.map((item) => item.id)).not.toContain(rightItem.id);

    const every = await listItems("?categoryId=");
    expect(every.map((item) => item.id)).toEqual(
      expect.arrayContaining([leftItem.id, rightItem.id])
    );
  });
});

describe("diner menu", () => {
  it("shows available items and hides unavailable ones", async () => {
    const category = await createCategory("Diner Visibility");
    const available = await createItem({
      name: "Available Dish",
      price: 9,
      categoryId: category.id,
    });
    const unavailable = await createItem({
      name: "Unavailable Dish",
      price: 9,
      categoryId: category.id,
      isAvailable: false,
    });
    const table = await createTable(700);

    const { body } = await request(`/api/v1/t/${table.qrCode}`);
    const ids = body.data.items.map((item: { id: string }) => item.id);

    expect(body.data.table.number).toBe(700);
    expect(ids).toContain(available.id);
    expect(ids).not.toContain(unavailable.id);
  });

  it("404s an unknown code instead of serving any menu", async () => {
    await request("/api/v1/t/not-a-real-table-token", { expect: 404 });
  });
});

describe("tables", () => {
  it("rejects a duplicate number and lets a table keep its own number", async () => {
    const first = await createTable(702);
    await createTable(703);

    const duplicate = await request("/api/v1/tables", {
      ...json("POST", { number: 702 }, session.headers),
      expect: 409,
    });
    expect(duplicate.body.errors[0].field).toBe("number");

    const other = (await listTables()).find((table) => table.number === 703)!;
    await request(`/api/v1/tables/${other.id}`, {
      ...json("PATCH", { number: 702 }, session.headers),
      expect: 409,
    });

    const same = await request(`/api/v1/tables/${other.id}`, {
      ...json("PATCH", { number: 703 }, session.headers),
    });
    expect(same.body.data.number).toBe(703);

    const moved = await request(`/api/v1/tables/${other.id}`, {
      ...json("PATCH", { number: 704 }, session.headers),
    });
    expect(moved.body.data.number).toBe(704);
    expect(first.number).toBe(702);
  });

  it("rotates the QR token so the old sticker stops working", async () => {
    const table = await createTable(701);

    const rotated = await request(`/api/v1/tables/${table.id}/regenerate-qr`, {
      method: "POST",
      headers: session.headers,
    });

    expect(rotated.body.data.qrCode).not.toBe(table.qrCode);
    await request(`/api/v1/t/${table.qrCode}`, { expect: 404 });
    await request(`/api/v1/t/${rotated.body.data.qrCode}`);
  });

  it("refuses to delete a table that has order history", async () => {
    const table = await createTable(705);
    const item = await createItem({
      name: "Table History Soup",
      price: 7,
      categoryId: baseCategory.id,
    });
    await placeOrder(table.qrCode, item.id);

    const blocked = await request(`/api/v1/tables/${table.id}`, {
      method: "DELETE",
      headers: session.headers,
      expect: 409,
    });
    expect(blocked.body.message).toMatch(/has orders/i);

    const empty = await createTable(706);
    await request(`/api/v1/tables/${empty.id}`, {
      method: "DELETE",
      headers: session.headers,
    });
  });

  it("refuses to delete an item that appears in an order", async () => {
    const table = await createTable(707);
    const item = await createItem({
      name: "Ordered Soup",
      price: 7,
      categoryId: baseCategory.id,
    });
    await placeOrder(table.qrCode, item.id);

    const blocked = await request(`/api/v1/menu/items/${item.id}`, {
      method: "DELETE",
      headers: session.headers,
      expect: 409,
    });
    expect(blocked.body.message).toMatch(/appears in past orders/i);

    const hidden = await request(`/api/v1/menu/items/${item.id}`, {
      ...json("PATCH", { isAvailable: false }, session.headers),
    });
    expect(hidden.body.data.isAvailable).toBe(false);
  });
});
