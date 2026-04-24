import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const E2E_ROOT = join(process.cwd(), "tests", "e2e");
const MIN_E2E_FILES = 24;
const MIN_E2E_TESTS = 231;
const MIN_E2E_FLOWS = 50;

function collectE2eFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectE2eFiles(fullPath, files);
      continue;
    }
    if (stats.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

test("[SYS-QUAL-7.2] e2e suite size does not regress", () => {
  const files = collectE2eFiles(E2E_ROOT);
  const flowTitles = new Set<string>();
  const testCount = files.reduce((count, file) => {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1\s*,/g)) {
      const title = match[2];
      if (title) {
        flowTitles.add(title.trim());
      }
    }
    return count + (source.match(/\b(?:test|it)\s*\(/g) ?? []).length;
  }, 0);
  const skipUsages = files.reduce((count, file) => {
    const source = readFileSync(file, "utf8");
    return count + (source.match(/\b(?:test|it|describe)\.skip\s*\(/g) ?? []).length;
  }, 0);

  assert.ok(files.length >= MIN_E2E_FILES, `E2E file count ${files.length} fell below ratchet ${MIN_E2E_FILES}`);
  assert.ok(testCount >= MIN_E2E_TESTS, `E2E test count ${testCount} fell below ratchet ${MIN_E2E_TESTS}`);
  assert.ok(flowTitles.size >= MIN_E2E_FLOWS, `E2E flow count ${flowTitles.size} fell below ratchet ${MIN_E2E_FLOWS}`);
  assert.equal(skipUsages, 0, `E2E suite contains ${skipUsages} skipped tests`);
});
