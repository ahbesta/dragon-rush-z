import { databaseUrl } from "./environment";
import { spawnSync } from "node:child_process";
const child = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/neon.test.ts"],
  { stdio: "inherit", env: { ...process.env, TEST_DATABASE_URL: databaseUrl() } },
);
process.exitCode = child.status ?? 1;
