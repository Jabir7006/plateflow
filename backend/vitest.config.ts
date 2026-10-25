import { defineConfig } from "vitest/config";

// Unit suite: pure logic, no database and no external services. Integration
// tests live in `vitest.integration.config.ts` because they need a disposable
// database and use a setup file that refuses to run without one.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup.unit.ts"],
    restoreMocks: true,
  },
});
