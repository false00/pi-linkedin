import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "--test",
  "tests/smoke.test.mjs",
  "tests/runtime.test.mjs",
  "tests/package.test.mjs",
], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
