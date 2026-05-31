#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const testsDir = join(process.cwd(), "tests");
const goldenTestsDir = join(testsDir, "golden");
const snapshotsDir = join(goldenTestsDir, "snapshots");
const goldenCallPattern = /\bassertGolden(?:Contains|Matches)?\(\s*"([^"]+)"/g;
const explicitSnapshotPathPattern = /tests\/golden\/snapshots\/([^"'`]+\.golden)/g;
const nonDeterministicTimePatterns = [
  /\bDate\.now\s*\(/,
  /\bnew Date\s*\(\s*\)/,
];
const referencedSnapshots = new Set();
const missingSnapshots = [];
const nondeterministicGoldenTests = [];

function walkTestFiles(directory, visited = new Set()) {
  const realDirectory = realpathSync(directory);
  if (visited.has(realDirectory)) {
    return [];
  }
  visited.add(realDirectory);
  const files = [];
  for (const entry of readdirSync(directory)) {
    const filePath = join(directory, entry);
    const stat = lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...walkTestFiles(filePath, visited));
      continue;
    }
    if (entry.endsWith(".test.ts")) {
      files.push(filePath);
    }
  }
  return files;
}

for (const filePath of walkTestFiles(testsDir)) {
  const content = readFileSync(filePath, "utf8");
  for (const pattern of nonDeterministicTimePatterns) {
    if (filePath.startsWith(goldenTestsDir) && pattern.test(content)) {
      nondeterministicGoldenTests.push(filePath);
      break;
    }
  }
  for (const match of content.matchAll(goldenCallPattern)) {
    const snapshotName = `${match[1]}.golden`;
    referencedSnapshots.add(snapshotName);
    const snapshotPath = join(snapshotsDir, snapshotName);
    if (!existsSync(snapshotPath)) {
      missingSnapshots.push(`${filePath}: ${match[1]}`);
    }
  }
  for (const match of content.matchAll(explicitSnapshotPathPattern)) {
    const snapshotName = resolve(snapshotsDir, match[1]).startsWith(snapshotsDir) ? match[1] : null;
    if (snapshotName == null) {
      continue;
    }
    referencedSnapshots.add(snapshotName);
    const snapshotPath = join(snapshotsDir, snapshotName);
    if (!existsSync(snapshotPath)) {
      missingSnapshots.push(`${filePath}: ${snapshotName}`);
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

if (nondeterministicGoldenTests.length > 0) {
  console.error("Golden tests must not depend on Date.now() or zero-arg new Date():");
  for (const filePath of nondeterministicGoldenTests) {
    console.error(`- ${filePath}`);
  }
}

if (missingSnapshots.length > 0 || orphanSnapshots.length > 0 || nondeterministicGoldenTests.length > 0) {
  process.exit(1);
}
