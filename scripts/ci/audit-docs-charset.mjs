#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["docs_zh", "docs_en", "divisions"];
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
  if (!existsSync(root)) {
    continue;
  }
  walk(root, (path) => {
    if (!path.endsWith(".md") && !path.endsWith(".prompt.md")) {
      return;
    }
    const source = readFileSync(path, "utf8");
    if (source.includes("�")) {
      failures.push(path);
    }
  });
}

if (existsSync("AGENTS.md")) {
  const source = readFileSync("AGENTS.md", "utf8");
  if (source.includes("�")) {
    failures.push("AGENTS.md");
  }
}

for (const path of failures) {
  console.error(`fail replacement-character detected in ${path}`);
}

if (failures.length > 0) {
  console.error(`docs charset audit failed: ${failures.length} file(s) contain replacement characters`);
  process.exit(1);
}

console.log("docs charset audit passed");
