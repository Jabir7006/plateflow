export interface MenuCategory {
  id: string;
  name: string;
  // How many menu items sit under this category. Drives the list UI and the
  // delete guard: a category with items cannot be removed until they are moved.
  itemCount: number;
}

export interface MenuItemSize {
  id: string;
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  // The single price when unsized; the cheapest size's price (the "from" price)
  // when the item has sizes. Derived server-side, so it always reflects `sizes`.
  price: number;
  description: string | null;
  // Populated by the image upload flow. Null until an image is attached.
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  // Denormalised so a list renders its category without a second lookup.
  categoryName: string;
  // Empty when the item is single-price; otherwise the diner picks one and pays
  // its price instead of `price`. Ordered for display.
  sizes: MenuItemSize[];
  // `imagePublicId` is deliberately absent: it is the storage handle the server
  // needs to replace or delete an image, and no client has a use for it.
}
