#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const registry = readFileSync("docs_zh/contracts/error_code_registry.md", "utf8");
const allowed = new Set(
  [...registry.matchAll(/`([a-z][a-z0-9_.]+)`/g)]
    .map((match) => match[1])
    .filter((code) => code.includes(".")),
);

const rootDir = "src/platform/five-plane-interface";
const matches = [];
if (!existsSync(rootDir)) {
  console.error(`missing audit root: ${rootDir}`);
  process.exit(2);
}
for (const filePath of listFiles(rootDir)) {
  const content = readFileSync(filePath, "utf8");
  for (const match of content.matchAll(/code:\s*"([^"]+)"/g)) {
    const lineNumber = content.slice(0, match.index ?? 0).split("\n").length;
    matches.push(`${filePath}:${lineNumber}:${match[0]}`);
  }
}

const failures = [];
for (const line of matches) {
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

function listFiles(root) {
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (entry === "node_modules" || entry === "dist" || entry === ".git") {
          continue;
        }
        stack.push(join(current, entry));
      }
      continue;
    }
    if (stat.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(current)) {
      results.push(current);
    }
  }
  return results.sort();
}
