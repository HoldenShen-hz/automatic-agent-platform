#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const registry = readFileSync("docs_zh/contracts/error_code_registry.md", "utf8");
const allowed = new Set(
  [...registry.matchAll(/`([a-z][a-z0-9_.]+)`/g)]
    .map((match) => match[1])
    .filter((code) => code.includes(".")),
);

const result = spawnSync(
  "rg",
  [
    "-n",
    'code:\\s*"[^"]+"',
    "src/platform/five-plane-interface",
  ],
  { encoding: "utf8" },
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0 && result.status !== 1) {
  throw new Error(result.stderr || "rg failed while auditing public error codes");
}

const failures = [];
for (const line of result.stdout.split("\n")) {
  if (!line.trim()) {
    continue;
  }
  const match = line.match(/code:\s*"([^"]+)"/);
  if (match == null) {
    continue;
  }
  const code = match[1];
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(code)) {
    failures.push(`non-canonical code ${code} at ${line}`);
    continue;
  }
  if (!allowed.has(code)) {
    failures.push(`unregistered code ${code} at ${line}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`public error code audit passed: ${allowed.size} registered codes available`);
