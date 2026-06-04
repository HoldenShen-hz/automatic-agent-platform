import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

test("methodology-required assurance entrypoints stay wired in package scripts", () => {
  const scripts = packageJson.scripts ?? {};

  assert.equal(
    scripts["assurance:full"],
    "node scripts/assurance/run-full-assurance.mjs",
  );
  assert.equal(
    scripts["assurance:inventory"],
    "node scripts/assurance/collect-source-inventory.mjs",
  );
  assert.equal(
    scripts["assurance:review-import"],
    "node scripts/assurance/review-import.mjs",
  );
  assert.equal(
    scripts["assurance:review-import:check"],
    "node scripts/assurance/review-import.mjs --check",
  );
  assert.equal(
    scripts["assurance:historical-promises"],
    "node scripts/assurance/collect-historical-promises.mjs",
  );
  assert.equal(
    scripts["assurance:eval-oracle"],
    "npm run audit:eval-oracle && npm run audit:redteam-runner && npm run audit:golden-replay",
  );
  assert.equal(
    scripts["assurance:issue-ledger"],
    "node scripts/assurance/build-issue-ledger.mjs",
  );
  assert.equal(
    scripts["assurance:coverage-scorecard"],
    "node scripts/assurance/build-coverage-scorecard.mjs",
  );
  assert.equal(
    scripts["evidence:bundle:create"],
    "node scripts/assurance/create-release-evidence-bundle.mjs",
  );
  assert.equal(
    scripts["evidence:bundle:verify"],
    "node scripts/assurance/verify-release-evidence-bundle.mjs",
  );
  assert.equal(
    scripts["rc:check"],
    "node scripts/assurance/rc-check.mjs",
  );
});
