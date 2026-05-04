import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const E2E_ROOT = join(process.cwd(), "tests", "e2e");
const DISALLOWED_SKIP_PATTERNS = [
  /\btest\.skip\s*\(/g,
  /\bit\.skip\s*\(/g,
  /\bdescribe\.skip\s*\(/g,
  /\bt\.skip\s*\(/g,
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

test("invariant: e2e test files do not contain explicit skip markers", () => {
  const violations: string[] = [];
  for (const file of listTestFiles(E2E_ROOT)) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const pattern of DISALLOWED_SKIP_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(file);
        break;
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Explicit test skips are not allowed in tests/e2e. Remove skip markers from: ${violations.join(", ")}`,
  );
});
