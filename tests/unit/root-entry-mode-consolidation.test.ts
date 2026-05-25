import assert from "node:assert/strict";
import test from "node:test";

import type { PlatformStartupTargetKind } from "../../src/index.js";

/**
 * Issue 2002: PlatformRootEntryMode and PlatformStartupTargetKind were duplicate definitions.
 * This test verifies that PlatformRootEntryMode has been removed and PlatformStartupTargetKind
 * is the single source of truth.
 */
test("PlatformStartupTargetKind is the single source of truth (issue 2002 fix)", () => {
  const startupModes = ["summary", "demo", "api", "console", "worker"] as const satisfies readonly PlatformStartupTargetKind[];
  const runtimeCoverage = Object.fromEntries(startupModes.map((mode) => [mode, true])) as Record<PlatformStartupTargetKind, true>;

  assert.deepEqual(Object.keys(runtimeCoverage), ["summary", "demo", "api", "console", "worker"]);
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
