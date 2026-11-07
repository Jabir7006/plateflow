import "dotenv/config";

const getEnv = (key: string, defaultValue?: string) => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

const getBoolean = (key: string, defaultValue: boolean) => {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return defaultValue;

  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;

  throw new Error(`Environment variable ${key} must be a boolean`);
};

const getPositiveInteger = (key: string, defaultValue: number) => {
  const raw = process.env[key]?.trim();
  if (!raw) return defaultValue;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }
  return value;
};

const NODE_ENV = getEnv("NODE_ENV", "development");
const isProduction = NODE_ENV === "production";

export const ENV = {
  PORT: getEnv("PORT", "5000"),
  DATABASE_URL: getEnv("DATABASE_URL"),
  DIRECT_URL: getEnv("DIRECT_URL"),
  NODE_ENV,
  APP_URL: getEnv("APP_URL"),
  MAIL_FROM: getEnv("MAIL_FROM", "PlateFlow <onboarding@resend.dev>"),
  RESEND_API_KEY: getEnv("RESEND_API_KEY"),
  CLOUDINARY_CLOUD_NAME: getEnv("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: getEnv("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: getEnv("CLOUDINARY_API_SECRET"),
  SEED_MANAGER_EMAIL: getEnv("SEED_MANAGER_EMAIL"),
  SEED_MANAGER_PASSWORD: getEnv("SEED_MANAGER_PASSWORD"),
  REFRESH_TOKEN_SECRET: getEnv("REFRESH_TOKEN_SECRET"),
  ACCESS_TOKEN_SECRET: getEnv("ACCESS_TOKEN_SECRET"),

  // Proxy hops in front of Express. The Next rewrite is one hop, so production
  // must set this to the real chain length for req.ip (rate limiting) to be the
  // client's address rather than the proxy's.
  TRUST_PROXY: getPositiveInteger("TRUST_PROXY", 1),
  JSON_BODY_LIMIT: getEnv("JSON_BODY_LIMIT", "1mb"),

  // Rate limiting is strict in production and off in development/test by
  // default, so local work and the test suite never hit 429. Override
  // RATE_LIMIT_ENABLED=true to exercise the limits locally.
  RATE_LIMIT_ENABLED: getBoolean("RATE_LIMIT_ENABLED", isProduction),
  RATE_LIMIT_WINDOW_MS: getPositiveInteger("RATE_LIMIT_WINDOW_MS", 60_000),
  RATE_LIMIT_PUBLIC_MAX: getPositiveInteger("RATE_LIMIT_PUBLIC_MAX", 120),
  RATE_LIMIT_WRITE_MAX: getPositiveInteger("RATE_LIMIT_WRITE_MAX", 20),
  RATE_LIMIT_AUTH_WINDOW_MS: getPositiveInteger(
    "RATE_LIMIT_AUTH_WINDOW_MS",
    15 * 60_000
  ),
  RATE_LIMIT_AUTH_MAX: getPositiveInteger("RATE_LIMIT_AUTH_MAX", 20),
} as const;
