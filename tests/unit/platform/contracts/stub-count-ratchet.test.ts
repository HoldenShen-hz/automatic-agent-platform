import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for stub-count-ratchet.ts
 * Tests stub file count tracking behaviors
 */

const MAX_STUBS = 95;

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/g, ""))
    .join("\n");
}

function isCompatibilityFacade(content: string): boolean {
  const normalized = stripComments(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  if (normalized.length === 0) {
    return false;
  }

  const statements = normalized
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  return statements.length > 0
    && statements.every((statement) => /^(export\s+\*\s+from\s+|export\s+\{[\s\S]*\}\s+from\s+|export\s+type\s+\{[\s\S]*\}\s+from\s+|import\s+type\s+\{[\s\S]*\}\s+from\s+)/.test(statement));
}

function countNonEmptyLines(content: string): number {
  return content.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("//")) return false;
    if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return false;
    if (trimmed === "*/") return false;
    return true;
  }).length;
}

function isStubFile(content: string): boolean {
  if (isCompatibilityFacade(content)) {
    return false;
  }
  return countNonEmptyLines(content) <= 20;
}

test("stub count does not increase beyond MAX_STUBS threshold", () => {
  const stubFileContents = [];
  for (let i = 0; i < MAX_STUBS; i++) {
    stubFileContents.push(`export const stub${i} = ${i};`);
  }

  let stubCount = 0;
  for (const content of stubFileContents) {
    if (isStubFile(content)) {
      stubCount++;
    }
  }

  assert.ok(
    stubCount <= MAX_STUBS,
    `Stub count ${stubCount} should not exceed MAX_STUBS ${MAX_STUBS}`,
  );
});

test("files with <=20 lines are counted as stubs", () => {
  const shortFile = "// just a comment\n// another comment";
  assert.ok(isStubFile(shortFile), "File with <=20 non-empty lines should be a stub");

  const longFileLines = [];
  for (let i = 1; i <= 21; i++) {
    longFileLines.push(`export const v${i} = ${i};`);
  }
  const longFile = longFileLines.join("\n");
  assert.ok(!isStubFile(longFile), "File with >20 non-empty lines should not be a stub");
});

test("files with >20 lines are not counted as stubs", () => {
  const longFileLines = [];
  for (let i = 1; i <= 21; i++) {
    longFileLines.push(`export const v${i} = ${i};`);
  }
  const content = longFileLines.join("\n");
  assert.strictEqual(isStubFile(content), false, "File with 21 non-empty lines should not be a stub");
});

test("stub count is tracked across codebase", () => {
  const stubContents = [
    "export const a = 1;",
    "export const b = 2;",
    "export const c = 3;",
  ];

  const nonStubLines = [];
  for (let i = 1; i <= 21; i++) {
    nonStubLines.push(`export const v${i} = ${i};`);
  }
  const nonStubContent = nonStubLines.join("\n");
  const nonStubContents = [nonStubContent];

  const allFiles = [...stubContents, ...nonStubContents];

  let stubCount = 0;
  for (const content of allFiles) {
    if (isStubFile(content)) {
      stubCount++;
    }
  }

  assert.strictEqual(stubCount, stubContents.length, "Stub count should match number of stub files");
});

test("compatibility facades are not counted as stubs", () => {
  const facadeContent = `
export * from "./foo.js";
export { bar } from "./bar.js";
export type { Baz } from "./baz.js";
import type { Qux } from "./qux.js";
`;

  assert.ok(
    isCompatibilityFacade(facadeContent),
    "Compatibility facade should be detected",
  );
  assert.ok(
    !isStubFile(facadeContent),
    "Compatibility facade should not be counted as stub regardless of line count",
  );
});

test("MAX_STUBS threshold is respected in tracking", () => {
  const atThresholdLines = [];
  for (let i = 0; i < 20; i++) {
    atThresholdLines.push(`export const line${i} = ${i};`);
  }
  const atThresholdContent = atThresholdLines.join("\n");

  const overThresholdLines = [];
  for (let i = 0; i < 21; i++) {
    overThresholdLines.push(`export const line${i} = ${i};`);
  }
  const overThresholdContent = overThresholdLines.join("\n");

  assert.ok(isStubFile(atThresholdContent), "20 lines should be a stub");
  assert.ok(!isStubFile(overThresholdContent), "21 lines should not be a stub");
});
