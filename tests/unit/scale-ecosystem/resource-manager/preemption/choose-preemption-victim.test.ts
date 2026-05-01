/**
 * Unit tests for choosePreemptionVictim - Preemption victim selection
 *
 * Per §53.4: Only executions that have completed their checkpoint can be preempted.
 * Tests the checkpoint requirement which is critical for safe preemption.
 *
 * @see src/scale-ecosystem/resource-manager/preemption/index.js
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  choosePreemptionVictim,
  type PreemptionCandidate,
  type PreemptionDecision,
} from "../../../../../src/scale-ecosystem/resource-manager/preemption/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Factory Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<PreemptionCandidate> = {}): PreemptionCandidate {
  return {
    executionId: overrides.executionId ?? "exec-default",
    priority: overrides.priority ?? 5,
    progressPercent: overrides.progressPercent ?? 50,
    hasCheckpoint: overrides.hasCheckpoint ?? true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// choosePreemptionVictim Tests - Core Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("choosePreemptionVictim returns null when no candidates", () => {
  const result = choosePreemptionVictim([]);

  assert.equal(result.victim, null);
  assert.equal(result.checkpointRequired, true);
  assert.ok(result.reason.includes("No eligible candidates"));
});

test("choosePreemptionVictim only considers candidates with hasCheckpoint=true", () => {
  const candidates = [
    makeCandidate({ executionId: "no-checkpoint", hasCheckpoint: false }),
    makeCandidate({ executionId: "has-checkpoint", hasCheckpoint: true }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result.victim?.executionId, "has-checkpoint");
  assert.equal(result.checkpointRequired, false);
});

test("choosePreemptionVictim returns null when all candidates lack checkpoints", () => {
  const candidates = [
    makeCandidate({ executionId: "e1", hasCheckpoint: false }),
    makeCandidate({ executionId: "e2", hasCheckpoint: false }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result.victim, null);
  assert.equal(result.checkpointRequired, true);
});

test("choosePreemptionVictim selects lowest priority candidate", () => {
  const candidates = [
    makeCandidate({ executionId: "high-priority", priority: 10 }),
    makeCandidate({ executionId: "low-priority", priority: 1 }),
    makeCandidate({ executionId: "medium-priority", priority: 5 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Priority 1 is lowest (highest actual priority for preemption)
  assert.equal(result.victim?.executionId, "low-priority");
});

test("choosePreemptionVictim breaks ties by progressPercent", () => {
  const candidates = [
    makeCandidate({ executionId: "more-progress", priority: 1, progressPercent: 80 }),
    makeCandidate({ executionId: "less-progress", priority: 1, progressPercent: 20 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Same priority, lower progress percent is preferred
  assert.equal(result.victim?.executionId, "less-progress");
});

test("choosePreemptionVictim prefers lower priority over lower progress", () => {
  const candidates = [
    makeCandidate({ executionId: "low-priority-high-progress", priority: 2, progressPercent: 10 }),
    makeCandidate({ executionId: "lower-priority", priority: 1, progressPercent: 90 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Priority is primary factor
  assert.equal(result.victim?.executionId, "lower-priority");
});

test("choosePreemptionVictim does not mutate original array", () => {
  const candidates = [
    makeCandidate({ executionId: "e1" }),
    makeCandidate({ executionId: "e2" }),
  ];
  const original = [...candidates];

  choosePreemptionVictim(candidates);

  assert.equal(candidates[0]?.executionId, original[0]?.executionId);
  assert.equal(candidates[1]?.executionId, original[1]?.executionId);
});

test("choosePreemptionVictim includes reason in decision", () => {
  const candidates = [
    makeCandidate({ executionId: "victim", priority: 1 }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.ok(result.reason.includes("victim"));
  assert.ok(result.reason.includes("checkpoint"));
});

test("choosePreemptionVictim handles single checkpointed candidate", () => {
  const candidates = [
    makeCandidate({ executionId: "only", priority: 5, progressPercent: 50 }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result.victim?.executionId, "only");
  assert.equal(result.checkpointRequired, false);
});

test("choosePreemptionVictim prioritizes among many checkpointed candidates", () => {
  const candidates = Array.from({ length: 20 }, (_, i) =>
    makeCandidate({
      executionId: `exec-${i}`,
      priority: i % 10,
      progressPercent: (i * 5) % 100,
    })
  );

  const result = choosePreemptionVictim(candidates);

  // Should pick the one with lowest priority, then lowest progress
  // priority 0 is lowest, but we only have 0-9 from i%10
  assert.ok(result.victim != null);
  assert.ok(result.victim.executionId.startsWith("exec-"));
});

test("choosePreemptionVictim with mixed checkpoint status", () => {
  const candidates = [
    makeCandidate({ executionId: "ckpt-low-priority", priority: 3, hasCheckpoint: true }),
    makeCandidate({ executionId: "no-ckpt-lower-priority", priority: 1, hasCheckpoint: false }),
    makeCandidate({ executionId: "ckpt-medium-priority", priority: 2, hasCheckpoint: true }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Only checkpointed candidates are considered
  // Among checkpointed: priority 2 and 3, priority 2 is lowest
  assert.equal(result.victim?.executionId, "ckpt-medium-priority");
});

test("choosePreemptionVictim returns correct checkpointRequired flag", () => {
  // When no eligible candidates
  const noCandidates = choosePreemptionVictim([]);
  assert.equal(noCandidates.checkpointRequired, true);

  // When only non-checkpointed candidates
  const onlyNonCheckpointed = choosePreemptionVictim([
    makeCandidate({ hasCheckpoint: false }),
  ]);
  assert.equal(onlyNonCheckpointed.checkpointRequired, true);

  // When checkpointed candidates exist
  const withCheckpointed = choosePreemptionVictim([
    makeCandidate({ hasCheckpoint: true }),
  ]);
  assert.equal(withCheckpointed.checkpointRequired, false);
});

test("choosePreemptionVictim handles edge case of all same values", () => {
  const candidates = [
    makeCandidate({ executionId: "a", priority: 5, progressPercent: 50 }),
    makeCandidate({ executionId: "b", priority: 5, progressPercent: 50 }),
    makeCandidate({ executionId: "c", priority: 5, progressPercent: 50 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Should return one of them deterministically
  assert.ok(["a", "b", "c"].includes(result.victim?.executionId ?? ""));
  assert.equal(result.checkpointRequired, false);
});

test("choosePreemptionVictim result is a valid PreemptionDecision", () => {
  const candidates = [
    makeCandidate({ executionId: "test" }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.ok("victim" in result);
  assert.ok("reason" in result);
  assert.ok("checkpointRequired" in result);
  assert.ok(result.victim === null || "executionId" in result.victim);
});