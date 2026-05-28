import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TEST_ROOTS = [
  "tests/unit/runtime",
  "tests/unit/platform/execution",
  "tests/unit/platform/five-plane-execution",
] as const;

function collectRelativeTests(rootPath: string): Set<string> {
  const results = new Set<string>();
  const absoluteRoot = resolve(REPO_ROOT, rootPath);

  const visit = (currentPath: string): void => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = resolve(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".test.ts")) {
        continue;
      }
      results.add(relative(absoluteRoot, absolutePath).replaceAll("\\", "/"));
    }
  };

  visit(absoluteRoot);
  return results;
}

test("runtime/execution canonical test trees do not carry duplicate relative test paths", () => {
  const collected = TEST_ROOTS.map((root) => ({ root, files: collectRelativeTests(root) }));

  for (let index = 0; index < collected.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < collected.length; compareIndex += 1) {
      const left = collected[index]!;
      const right = collected[compareIndex]!;
      const duplicates = [...left.files].filter((file) => right.files.has(file));
      assert.deepEqual(
        duplicates,
        [],
        `${left.root} and ${right.root} must not share duplicate relative test files`,
      );
    }
  }
});
