/**
 * Integration Tests: Autonomy Level Manager
 *
 * Tests level comparison, ordering, and promotion logic.
 *
 * Root cause §175-2042: "frozen" was not in AUTONOMY_LEVEL_ORDER, so it compared
 * as greater than "full_auto" (index -1 vs index 3), causing frozen agents to be
 * treated as having higher autonomy than fully-automated agents.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import {
  AUTONOMY_LEVEL_ORDER,
  compareAutonomyLevels,
  nextAutonomyLevel,
} from "../../../../src/interaction/autonomy/level-manager/index.js";
import type { AutonomyLevel } from "../../../../src/interaction/autonomy/index.js";

function createIntegrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  return { workspace, cleanup: () => cleanupPath(workspace) };
}

// ============================================================================
// AUTONOMY_LEVEL_ORDER verification
// ============================================================================

test("LevelManager: AUTONOMY_LEVEL_ORDER includes all five levels", () => {
  const ctx = createIntegrationContext("aa-level-order-");
  try {
    assert.equal(AUTONOMY_LEVEL_ORDER.length, 5, "Should have 5 levels");
    assert.ok(AUTONOMY_LEVEL_ORDER.includes("frozen"), "Should include frozen");
    assert.ok(AUTONOMY_LEVEL_ORDER.includes("suggestion"), "Should include suggestion");
    assert.ok(AUTONOMY_LEVEL_ORDER.includes("supervised"), "Should include supervised");
    assert.ok(AUTONOMY_LEVEL_ORDER.includes("semi_auto"), "Should include semi_auto");
    assert.ok(AUTONOMY_LEVEL_ORDER.includes("full_auto"), "Should include full_auto");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: frozen is the lowest autonomy level", () => {
  const ctx = createIntegrationContext("aa-level-frozen-lowest-");
  try {
    const frozenIndex = AUTONOMY_LEVEL_ORDER.indexOf("frozen");
    const fullAutoIndex = AUTONOMY_LEVEL_ORDER.indexOf("full_auto");
    assert.ok(frozenIndex < fullAutoIndex, "frozen should have lower index than full_auto");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: full_auto is the highest autonomy level", () => {
  const ctx = createIntegrationContext("aa-level-full-highest-");
  try {
    const fullAutoIndex = AUTONOMY_LEVEL_ORDER.indexOf("full_auto");
    // full_auto should be the last in the order
    assert.equal(fullAutoIndex, AUTONOMY_LEVEL_ORDER.length - 1, "full_auto should be last");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Level Comparison
// ============================================================================

test("LevelManager: compareAutonomyLevels returns negative when left < right", () => {
  const ctx = createIntegrationContext("aa-compare-lt-");
  try {
    const result = compareAutonomyLevels("frozen", "full_auto");
    assert.ok(result < 0, "frozen should be less than full_auto");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: compareAutonomyLevels returns positive when left > right", () => {
  const ctx = createIntegrationContext("aa-compare-gt-");
  try {
    const result = compareAutonomyLevels("full_auto", "frozen");
    assert.ok(result > 0, "full_auto should be greater than frozen");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: compareAutonomyLevels returns 0 for same level", () => {
  const ctx = createIntegrationContext("aa-compare-eq-");
  try {
    assert.equal(compareAutonomyLevels("supervised", "supervised"), 0);
    assert.equal(compareAutonomyLevels("full_auto", "full_auto"), 0);
    assert.equal(compareAutonomyLevels("frozen", "frozen"), 0);
  } finally {
    ctx.cleanup();
  }
});

// §175-2042 fix verification
test("LevelManager: frozen does NOT compare as greater than full_auto (root cause verification)", () => {
  const ctx = createIntegrationContext("aa-compare-root-cause-");
  try {
    // The bug was that frozen had index -1 (not found), making it seem > full_auto
    const frozenIndex = AUTONOMY_LEVEL_ORDER.indexOf("frozen");
    assert.ok(frozenIndex >= 0, "frozen should be found in order (index >= 0)");
    assert.ok(frozenIndex < AUTONOMY_LEVEL_ORDER.indexOf("full_auto"), "frozen should be less than full_auto");

    const result = compareAutonomyLevels("frozen", "full_auto");
    assert.ok(result < 0, "frozen should be less than full_auto (not greater as in bug)");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Next Level Calculation
// ============================================================================

test("LevelManager: nextAutonomyLevel from frozen stays frozen", () => {
  const ctx = createIntegrationContext("aa-next-frozen-");
  try {
    const result = nextAutonomyLevel("frozen");
    assert.equal(result, "frozen", "frozen requires explicit recovery");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: nextAutonomyLevel from suggestion returns supervised", () => {
  const ctx = createIntegrationContext("aa-next-suggestion-");
  try {
    const result = nextAutonomyLevel("suggestion");
    assert.equal(result, "supervised", "suggestion -> supervised");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: nextAutonomyLevel from supervised returns semi_auto", () => {
  const ctx = createIntegrationContext("aa-next-supervised-");
  try {
    const result = nextAutonomyLevel("supervised");
    assert.equal(result, "semi_auto", "supervised -> semi_auto");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: nextAutonomyLevel from semi_auto returns full_auto", () => {
  const ctx = createIntegrationContext("aa-next-semi-");
  try {
    const result = nextAutonomyLevel("semi_auto");
    assert.equal(result, "full_auto", "semi_auto -> full_auto");
  } finally {
    ctx.cleanup();
  }
});

test("LevelManager: nextAutonomyLevel from full_auto stays at full_auto (ceiling)", () => {
  const ctx = createIntegrationContext("aa-next-full-");
  try {
    const result = nextAutonomyLevel("full_auto");
    assert.equal(result, "full_auto", "full_auto is the ceiling");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// All level transitions
// ============================================================================

test("LevelManager: every level can be compared with every other level", () => {
  const ctx = createIntegrationContext("aa-compare-all-");
  try {
    const levels: AutonomyLevel[] = ["frozen", "suggestion", "supervised", "semi_auto", "full_auto"];

    for (const left of levels) {
      for (const right of levels) {
        const result = compareAutonomyLevels(left, right);
        assert.ok(typeof result === "number", `Comparison ${left} vs ${right} should return number`);

        if (left === right) {
          assert.equal(result, 0, `${left} vs ${right} should be 0`);
        } else if (AUTONOMY_LEVEL_ORDER.indexOf(left) < AUTONOMY_LEVEL_ORDER.indexOf(right)) {
          assert.ok(result < 0, `${left} should be less than ${right}`);
        } else {
          assert.ok(result > 0, `${left} should be greater than ${right}`);
        }
      }
    }
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Level chain verification
// ============================================================================

test("LevelManager: chain from suggestion to full_auto covers promotable levels", () => {
  const ctx = createIntegrationContext("aa-chain-");
  try {
    let current: AutonomyLevel = "suggestion";
    const visited: AutonomyLevel[] = [current];

    for (let i = 0; i < 10; i++) { // Safety limit
      const next = nextAutonomyLevel(current);
      if (next === current) break; // Reached ceiling
      visited.push(next);
      current = next;
    }

    assert.ok(visited.includes("suggestion"), "Chain should reach suggestion");
    assert.ok(visited.includes("supervised"), "Chain should reach supervised");
    assert.ok(visited.includes("semi_auto"), "Chain should reach semi_auto");
    assert.ok(visited.includes("full_auto"), "Chain should reach full_auto");
    assert.equal(visited.length, 4, "Chain should visit exactly 4 promotable levels");
  } finally {
    ctx.cleanup();
  }
});
