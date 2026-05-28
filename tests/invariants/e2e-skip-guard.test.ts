import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const TEST_ROOTS = [
  join(process.cwd(), "tests", "e2e"),
  join(process.cwd(), "tests", "unit"),
  join(process.cwd(), "tests", "integration"),
  join(process.cwd(), "tests", "golden"),
] as const;
const DISALLOWED_SKIP_PATTERNS = [
  /\btest\.skip\s*\(/g,
  /\bit\.skip\s*\(/g,
  /\bdescribe\.skip\s*\(/g,
  /\bt\.skip\s*\(/g,
  /\bserialTest\s*\([^,\n]+,\s*["']skip["']/g,
];

function listTestFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("invariant: core test roots do not contain explicit skip markers", () => {
  const violations: string[] = [];
  for (const root of TEST_ROOTS) {
    for (const file of listTestFiles(root)) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const pattern of DISALLOWED_SKIP_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(file);
          break;
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Explicit test skips are not allowed in core test roots. Remove skip markers from: ${violations.join(", ")}`,
  );
});
