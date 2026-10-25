import { accessTokenPayload } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: accessTokenPayload;
      // The tenant every staff query is scoped by. Set by `tenantContext` from
      // the authenticated user; never read from the client. Absent on public
      // routes (the diner path resolves its tenant from the table token).
      restaurantId?: string;
    }
  }
}
