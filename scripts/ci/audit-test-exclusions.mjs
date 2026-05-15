#!/usr/bin/env node
import { readFileSync } from "node:fs";

const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
const exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
const testExcludes = exclude.filter((entry) => /test|tests|e2e|integration|golden/i.test(String(entry)));

const summary = {
  totalExcludeEntries: exclude.length,
  testExcludeEntries: testExcludes.length,
  testExcludes,
};

console.log(JSON.stringify(summary, null, 2));
