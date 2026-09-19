export interface Table {
  id: string;
  number: number;
  // The opaque, unguessable token a printed QR code encodes. The public
  // ordering route resolves it back to this table. Staff never edit it.
  qrCode: string;
  // How many orders reference this table. Drives the delete guard: a table with
  // orders cannot be removed, since order history references it.
  orderCount: number;
}
