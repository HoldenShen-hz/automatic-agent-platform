#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const goldenTestsDir = join(process.cwd(), "tests", "golden");
const snapshotsDir = join(goldenTestsDir, "snapshots");
const goldenCallPattern = /\bassertGolden(?:Contains|Matches)?\(\s*"([^"]+)"/g;
const referencedSnapshots = new Set();
const missingSnapshots = [];

for (const entry of readdirSync(goldenTestsDir)) {
  if (!entry.endsWith(".test.ts")) {
    continue;
  }
  const filePath = join(goldenTestsDir, entry);
  const content = readFileSync(filePath, "utf8");
  for (const match of content.matchAll(goldenCallPattern)) {
    const snapshotName = `${match[1]}.golden`;
    referencedSnapshots.add(snapshotName);
    const snapshotPath = join(snapshotsDir, snapshotName);
    if (!existsSync(snapshotPath)) {
      missingSnapshots.push(`${entry}: ${match[1]}`);
    }
  }
}

const orphanSnapshots = readdirSync(snapshotsDir)
  .filter((entry) => entry.endsWith(".golden") && !referencedSnapshots.has(entry))
  .sort();

if (missingSnapshots.length > 0) {
  console.error("Missing golden snapshots:");
  for (const missing of missingSnapshots) {
    console.error(`- ${missing}`);
  }
}

if (orphanSnapshots.length > 0) {
  console.error("Orphan golden snapshots:");
  for (const orphan of orphanSnapshots) {
    console.error(`- ${orphan}`);
  }
}

if (missingSnapshots.length > 0 || orphanSnapshots.length > 0) {
  process.exit(1);
}
