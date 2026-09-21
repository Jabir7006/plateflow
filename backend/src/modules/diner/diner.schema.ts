import { z } from "zod";

// The QR token is a Table.qrCode (a base64url randomId). We only guard against
// an empty/absurd segment here — the real check is the DB lookup, which 404s an
// unknown token. Kept backend-local: no client ever parses this.
export const tableTokenSchema = z.object({
  params: z.object({
    token: z
      .string("A table code is required")
      .trim()
      .min(1, "A table code is required")
      .max(128, "That doesn't look like a valid table code"),
  }),
});

export type TableTokenSchema = z.infer<typeof tableTokenSchema>;
