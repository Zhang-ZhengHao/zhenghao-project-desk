import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ["tests/integration/**/*.test.ts"],
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
