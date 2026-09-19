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
} as const;
