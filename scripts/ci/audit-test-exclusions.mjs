#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
const exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
const testExcludes = exclude.filter((entry) => /test|tests|e2e|integration|golden/i.test(String(entry)));
const baselinePath = join(process.cwd(), "config", "quality", "test-exclusion-allowlist.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const baselineSet = new Set(Array.isArray(baseline) ? baseline.map(String) : []);
const actualSet = new Set(testExcludes.map(String));

const unexpected = [...actualSet].filter((entry) => !baselineSet.has(entry)).sort();
const missing = [...baselineSet].filter((entry) => !actualSet.has(entry)).sort();

const summary = {
  totalExcludeEntries: exclude.length,
  testExcludeEntries: testExcludes.length,
  testExcludes,
  baselineEntries: baselineSet.size,
  unexpected,
  missing,
};

console.log(JSON.stringify(summary, null, 2));

if (unexpected.length > 0 || missing.length > 0) {
  console.error("test exclusion allowlist drift detected");
  process.exit(1);
}
