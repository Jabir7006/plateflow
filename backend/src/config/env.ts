import "dotenv/config";

const getEnv = (key: string, defaultValue?: string) => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

export const ENV = {
  PORT: getEnv("PORT", "5000"),
  DATABASE_URL: getEnv("DATABASE_URL"),
  DIRECT_URL: getEnv("DIRECT_URL"),
  NODE_ENV: getEnv("NODE_ENV", "development"),
  SEED_MANAGER_EMAIL: getEnv("SEED_MANAGER_EMAIL"),
  SEED_MANAGER_PASSWORD: getEnv("SEED_MANAGER_PASSWORD"),
  REFRESH_TOKEN_SECRET: getEnv("REFRESH_TOKEN_SECRET"),
  ACCESS_TOKEN_SECRET: getEnv("ACCESS_TOKEN_SECRET"),
} as const;
