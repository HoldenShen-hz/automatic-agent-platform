#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const goldenTestsDir = join(process.cwd(), "tests", "golden");
const snapshotsDir = join(goldenTestsDir, "snapshots");
const goldenCallPattern = /\bassertGolden(?:Contains|Matches)?\(\s*"([^"]+)"/g;
const missingSnapshots = [];

for (const entry of readdirSync(goldenTestsDir)) {
  if (!entry.endsWith(".test.ts")) {
    continue;
  }
  const filePath = join(goldenTestsDir, entry);
  const content = readFileSync(filePath, "utf8");
  for (const match of content.matchAll(goldenCallPattern)) {
    const snapshotName = match[1];
    const snapshotPath = join(snapshotsDir, `${snapshotName}.golden`);
    if (!existsSync(snapshotPath)) {
      missingSnapshots.push(`${entry}: ${snapshotName}`);
    }
  }
}

if (missingSnapshots.length > 0) {
  console.error("Missing golden snapshots:");
  for (const missing of missingSnapshots) {
    console.error(`- ${missing}`);
  }
  process.exit(1);
}
