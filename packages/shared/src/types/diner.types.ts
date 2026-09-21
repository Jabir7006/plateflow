import type { MenuItem } from "./menu.types.js";

// What a diner sees after scanning a table's QR code: the table they're sitting
// at plus the restaurant's available menu, in one payload. Read-only — ordering
// is a later feature. `items` are already filtered to available and sorted by
// category then name, so the client groups them without a second decision.
export interface TableMenu {
  table: {
    number: number;
  };
  items: MenuItem[];
}
