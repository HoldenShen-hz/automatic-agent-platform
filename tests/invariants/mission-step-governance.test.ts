import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

test("Mission canonical contracts do not introduce step-centric Mission fields", () => {
  const files = [
    "src/platform/contracts/mission/index.ts",
    "src/platform/five-plane-control-plane/mission/index.ts",
    "src/platform/five-plane-state-evidence/truth/mission-repository.ts",
  ];

  for (const file of files) {
    const content = readFileSync(join(ROOT, file), "utf8");
    assert.equal(/\bstep(Id|Index|Status|Output|s)\b/.test(content), false, `${file} must stay graph/node-centric`);
  }
});
