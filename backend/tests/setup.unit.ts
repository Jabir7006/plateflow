import "dotenv/config";

// Unit tests must run anywhere — no database, no provider keys, no .env. Modules
// such as `config/env.ts` read their configuration at import time, so give every
// required key a deterministic dummy before a test imports them. Anything the
// suite actually cares about (secrets, NODE_ENV) is pinned rather than defaulted.
process.env.NODE_ENV = "test";

const fallback = (key: string, value: string) => {
  if (!process.env[key]) process.env[key] = value;
};

fallback("DATABASE_URL", "postgresql://unit:unit@127.0.0.1:5432/unit");
fallback("DIRECT_URL", "postgresql://unit:unit@127.0.0.1:5432/unit");
fallback("APP_URL", "http://localhost:3000");
fallback("RESEND_API_KEY", "re_unit_test");
fallback("CLOUDINARY_CLOUD_NAME", "unit");
fallback("CLOUDINARY_API_KEY", "unit");
fallback("CLOUDINARY_API_SECRET", "unit");
fallback("SEED_MANAGER_EMAIL", "unit@example.com");
fallback("SEED_MANAGER_PASSWORD", "unit-password");

// The JWT tests sign real tokens; fixed values keep verification reproducible.
process.env.ACCESS_TOKEN_SECRET = "unit-access-token-secret";
process.env.REFRESH_TOKEN_SECRET = "unit-refresh-token-secret";
