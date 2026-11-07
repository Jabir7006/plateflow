import helmet, { type HelmetOptions } from "helmet";
import { ENV } from "../config/env.js";

// Security headers on every API response. CSP and HSTS only make sense on the
// production HTTPS origin; leaving them off locally keeps the developer tools
// and Next's dev server uncomplicated. CORP is cross-origin because the browser
// frontend is a separate origin from the API.
const helmetOptions: HelmetOptions = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  ...(ENV.NODE_ENV === "production"
    ? {}
    : { contentSecurityPolicy: false, hsts: false }),
};

export const securityHeaders = helmet(helmetOptions);
