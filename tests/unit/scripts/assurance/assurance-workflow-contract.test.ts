import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const ciWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

test("CI workflow keeps nightly assurance wired to the scheduled run", () => {
  assert.match(ciWorkflow, /cron:\s*"0 5 \* \* \*"/);
  assert.match(ciWorkflow, /name:\s+Nightly Full Assurance/);
  assert.match(ciWorkflow, /if:\s+github\.event_name == 'schedule'/);
  assert.match(ciWorkflow, /run:\s+npm run assurance:full/);
  assert.match(ciWorkflow, /artifacts\/assurance\//);
});
