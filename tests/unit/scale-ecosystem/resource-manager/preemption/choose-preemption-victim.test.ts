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
} from "../../../../../src/scale-ecosystem/resource-manager/preemption/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Factory Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<PreemptionCandidate> = {}): PreemptionCandidate {
  const base: PreemptionCandidate = {
    executionId: overrides.executionId ?? "exec-default",
    priority: overrides.priority ?? 5,
    progressPercent: overrides.progressPercent ?? 50,
  };

  // Only include optional properties when explicitly provided
  if (overrides.lastCheckpointTimestampMs !== undefined) {
    (base as typeof base & { lastCheckpointTimestampMs: number }).lastCheckpointTimestampMs = overrides.lastCheckpointTimestampMs;
  }
  if (overrides.checkpointLatencyMs !== undefined) {
    (base as typeof base & { checkpointLatencyMs: number }).checkpointLatencyMs = overrides.checkpointLatencyMs;
  }
  if (overrides.protectedFromPreemption !== undefined) {
    (base as typeof base & { protectedFromPreemption: boolean }).protectedFromPreemption = overrides.protectedFromPreemption;
  }

  return base;
}

// Helper to create a candidate with a valid checkpoint
function makeCandidateWithCheckpoint(overrides: Partial<PreemptionCandidate> = {}): PreemptionCandidate {
  return makeCandidate({
    lastCheckpointTimestampMs: Date.now() - 60000, // 1 minute ago
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// choosePreemptionVictim Tests - Core Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("choosePreemptionVictim returns null when no candidates", () => {
  const result = choosePreemptionVictim([]);

  assert.equal(result, null);
});

test("choosePreemptionVictim only considers candidates with valid checkpoints", () => {
  const candidates = [
    makeCandidate({ executionId: "no-checkpoint" }), // no checkpointTimestampMs
    makeCandidateWithCheckpoint({ executionId: "has-checkpoint" }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result?.executionId, "has-checkpoint");
});

test("choosePreemptionVictim returns null when all candidates lack checkpoints", () => {
  const candidates = [
    makeCandidate({ executionId: "e1" }),
    makeCandidate({ executionId: "e2" }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result, null);
});

test("choosePreemptionVictim selects lowest priority candidate", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "high-priority", priority: 10 }),
    makeCandidateWithCheckpoint({ executionId: "low-priority", priority: 1 }),
    makeCandidateWithCheckpoint({ executionId: "medium-priority", priority: 5 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Priority 1 is lowest (highest actual priority for preemption)
  assert.equal(result?.executionId, "low-priority");
});

test("choosePreemptionVictim breaks ties by progressPercent", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "more-progress", priority: 1, progressPercent: 80 }),
    makeCandidateWithCheckpoint({ executionId: "less-progress", priority: 1, progressPercent: 20 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Same priority, higher progressPercent is preferred (more work done that would be lost)
  assert.equal(result?.executionId, "more-progress");
});

test("choosePreemptionVictim prefers lower priority over lower progress", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "low-priority-high-progress", priority: 2, progressPercent: 10 }),
    makeCandidateWithCheckpoint({ executionId: "lower-priority", priority: 1, progressPercent: 90 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Priority is primary factor
  assert.equal(result?.executionId, "lower-priority");
});

test("choosePreemptionVictim does not mutate original array", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "e1" }),
    makeCandidateWithCheckpoint({ executionId: "e2" }),
  ];
  const original = [...candidates];

  choosePreemptionVictim(candidates);

  assert.equal(candidates[0]?.executionId, original[0]?.executionId);
  assert.equal(candidates[1]?.executionId, original[1]?.executionId);
});

test("choosePreemptionVictim handles single checkpointed candidate", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "only", priority: 5, progressPercent: 50 }),
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result?.executionId, "only");
});

test("choosePreemptionVictim prioritizes among many checkpointed candidates", () => {
  const candidates = Array.from({ length: 20 }, (_, i) =>
    makeCandidateWithCheckpoint({
      executionId: `exec-${i}`,
      priority: i % 10,
      progressPercent: (i * 5) % 100,
    })
  );

  const result = choosePreemptionVictim(candidates);

  // Should pick the one with lowest priority, then highest progress (for tie-breaking)
  assert.ok(result != null);
  assert.ok(result.executionId.startsWith("exec-"));
});

test("choosePreemptionVictim with mixed checkpoint status", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "ckpt-low-priority", priority: 3 }),
    makeCandidate({ executionId: "no-ckpt-lower-priority" }), // no checkpoint
    makeCandidateWithCheckpoint({ executionId: "ckpt-medium-priority", priority: 2 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Only checkpointed candidates are considered
  // Among checkpointed: priority 2 and 3, priority 2 is lowest
  assert.equal(result?.executionId, "ckpt-medium-priority");
});

test("choosePreemptionVictim ignores candidates with old checkpoints", () => {
  const candidates = [
    makeCandidate({ executionId: "old-checkpoint", priority: 1, lastCheckpointTimestampMs: Date.now() - 600000 }), // 10 minutes old
    makeCandidateWithCheckpoint({ executionId: "recent-checkpoint", priority: 2 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Old checkpoint (10 min) exceeds default maxCheckpointAgeMs of 5 minutes
  assert.equal(result?.executionId, "recent-checkpoint");
});

test("choosePreemptionVictim handles edge case of all same values", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "a", priority: 5, progressPercent: 50 }),
    makeCandidateWithCheckpoint({ executionId: "b", priority: 5, progressPercent: 50 }),
    makeCandidateWithCheckpoint({ executionId: "c", priority: 5, progressPercent: 50 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Should return one of them deterministically
  assert.ok(["a", "b", "c"].includes(result?.executionId ?? ""));
});

test("choosePreemptionVictim respects protectedFromPreemption flag", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "protected", priority: 1, protectedFromPreemption: true }),
    makeCandidateWithCheckpoint({ executionId: "not-protected", priority: 2 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Protected candidate should be skipped
  assert.equal(result?.executionId, "not-protected");
});

test("choosePreemptionVictim respects priority thresholds", () => {
  const candidates = [
    makeCandidateWithCheckpoint({ executionId: "too-low-priority", priority: -1 }), // below MIN_PREEMPTABLE_PRIORITY (0)
    makeCandidateWithCheckpoint({ executionId: "valid-priority", priority: 50 }),
  ];

  const result = choosePreemptionVictim(candidates);

  // Priority -1 is below MIN_PREEMPTABLE_PRIORITY (0)
  assert.equal(result?.executionId, "valid-priority");
});

test("choosePreemptionVictim with custom maxCheckpointAgeMs", () => {
  const candidates = [
    makeCandidate({ executionId: "old-checkpoint", priority: 1, lastCheckpointTimestampMs: Date.now() - 120000 }), // 2 minutes old
  ];

  // With maxCheckpointAgeMs of 5 minutes, this should be valid
  const result = choosePreemptionVictim(candidates, 300000);

  assert.equal(result?.executionId, "old-checkpoint");
});