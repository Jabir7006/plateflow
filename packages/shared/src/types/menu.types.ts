export interface MenuCategory {
  id: string;
  name: string;
  // How many menu items sit under this category. Drives the list UI and the
  // delete guard: a category with items cannot be removed until they are moved.
  itemCount: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  // Populated by the image upload flow. Null until an image is attached.
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  // Denormalised so a list renders its category without a second lookup.
  categoryName: string;
  // `imagePublicId` is deliberately absent: it is the storage handle the server
  // needs to replace or delete an image, and no client has a use for it.
}
