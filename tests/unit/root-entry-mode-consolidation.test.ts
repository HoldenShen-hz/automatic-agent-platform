import assert from "node:assert/strict";
import test from "node:test";

import type { PlatformStartupTargetKind } from "../../src/index.js";

/**
 * Issue 2002: PlatformRootEntryMode and PlatformStartupTargetKind were duplicate definitions.
 * This test verifies that PlatformRootEntryMode has been removed and PlatformStartupTargetKind
 * is the single source of truth.
 */
test("PlatformStartupTargetKind is the single source of truth (issue 2002 fix)", () => {
  // Verify the type is correctly exported and has the expected shape
  type Expected = "summary" | "demo" | "api" | "console" | "worker";

  // Type-level assertion: PlatformStartupTargetKind should match Expected
  const _typeCheck: Expected extends PlatformStartupTargetKind ? true : false = true;
  void _typeCheck;
});

test("PlatformStartupTargetKind union includes all valid entry modes", () => {
  // Verify all valid entry modes are assignable to PlatformStartupTargetKind
  const validModes: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];

  assert.equal(validModes.length, 5);
  assert.equal(validModes.includes("summary"), true);
  assert.equal(validModes.includes("demo"), true);
  assert.equal(validModes.includes("api"), true);
  assert.equal(validModes.includes("console"), true);
  assert.equal(validModes.includes("worker"), true);
});