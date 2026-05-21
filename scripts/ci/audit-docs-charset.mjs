#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["docs_zh/contracts", "docs_en/contracts"];
const failures = [];

function walk(path, visitor) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path).sort()) {
      walk(join(path, entry), visitor);
    }
    return;
  }
  visitor(path);
}

for (const root of roots) {
  walk(root, (path) => {
    if (!path.endsWith(".md")) {
      return;
    }
    const source = readFileSync(path, "utf8");
    if (source.includes("�")) {
      failures.push(path);
    }
  });
}

for (const path of failures) {
  console.error(`fail replacement-character detected in ${path}`);
}

if (failures.length > 0) {
  console.error(`docs charset audit failed: ${failures.length} file(s) contain replacement characters`);
  process.exit(1);
}

console.log("docs charset audit passed");
