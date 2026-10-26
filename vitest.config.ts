import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Isolated SQLite database (prisma/test.db), never the dev database.
    env: { DATABASE_URL: "file:./test.db" },
    // Tests share one SQLite file, so run files sequentially.
    fileParallelism: false,
  },
});
