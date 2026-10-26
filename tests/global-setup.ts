import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/** Recreates prisma/test.db from the committed migrations before each test run. */
export default function setup() {
  const dbFile = path.resolve(__dirname, "../prisma/test.db");
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
