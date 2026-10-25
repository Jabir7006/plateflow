import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The suite provisions real restaurants in the test database and cleans them
    // up afterwards, so files must not interleave with each other.
    fileParallelism: false,
    include: ["tests/integration/**/*.test.ts"],
    // Neon is a remote database: a cold connection plus bcrypt provisioning can
    // take well over the 5s default.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["tests/setup.integration.ts"],
  },
});
