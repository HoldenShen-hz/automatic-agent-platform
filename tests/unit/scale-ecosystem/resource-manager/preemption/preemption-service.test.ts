import assert from "node:assert/strict";
import test from "node:test";
import { PreemptionService, type PreemptionServiceOptions } from "../../../../../src/scale-ecosystem/resource-manager/preemption/preemption-service.js";
import type { PreemptionCandidate } from "../../../../../src/scale-ecosystem/resource-manager/preemption/index.js";

const NOW = Date.now();
const RECENT_CHECKPOINT_MS = NOW - 1_000;
const OLD_CHECKPOINT_MS = NOW - 600_000; // 10 minutes old

function makeCandidate(overrides: Partial<PreemptionCandidate> = {}): PreemptionCandidate {
  return {
    executionId: "exec-1",
    priority: 50,
    progressPercent: 50,
    lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS,
    ...overrides,
  };
}

test("PreemptionService selects lowest priority victim [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 10 }),
    makeCandidate({ executionId: "e2", priority: 5 }),
    makeCandidate({ executionId: "e3", priority: 15 }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e2");
  assert.equal(result.eligibleCandidates, 3);
  assert.equal(result.filteredCount, 0);
});

test("PreemptionService breaks ties by higher progress percent [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 5, progressPercent: 30 }),
    makeCandidate({ executionId: "e2", priority: 5, progressPercent: 80 }),
    makeCandidate({ executionId: "e3", priority: 5, progressPercent: 50 }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e2");
});

test("PreemptionService returns null when no candidates [preemption-service]", () => {
  const service = new PreemptionService();
  const result = service.selectVictim([]);

  assert.equal(result.victim, null);
  assert.equal(result.eligibleCandidates, 0);
  assert.equal(result.filteredCount, 0);
});

test("PreemptionService filters protected candidates [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 5 }),
    makeCandidate({ executionId: "e2", priority: 3, protectedFromPreemption: true }),
    makeCandidate({ executionId: "e3", priority: 7 }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e1"); // priority 5 is lowest among unprotected
  assert.equal(result.eligibleCandidates, 2);
  assert.equal(result.filteredCount, 1);
});

test("PreemptionService filters candidates without valid checkpoints [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 5, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
    makeCandidate({ executionId: "e2", priority: 3, lastCheckpointTimestampMs: 0 }), // no checkpoint
    makeCandidate({ executionId: "e3", priority: 7, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e1");
  // All three are non-protected, so eligibleCandidates=3, filteredCount=0
  // e2 has no checkpoint (timestamp 0) so hasValidCheckpoint=false
  // But eligibleCandidates counts non-protected, not those failing checkpoint requirement
  assert.equal(result.eligibleCandidates, 3);
  assert.equal(result.filteredCount, 0);
});

test("PreemptionService filters candidates with stale checkpoints [preemption-service]", () => {
  const service = new PreemptionService({ maxCheckpointAgeMs: 300_000 });
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 5, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
    makeCandidate({ executionId: "e2", priority: 3, lastCheckpointTimestampMs: OLD_CHECKPOINT_MS }), // too old
    makeCandidate({ executionId: "e3", priority: 7, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e1");
});

test("PreemptionService respects custom maxCheckpointAgeMs [preemption-service]", () => {
  const service = new PreemptionService({ maxCheckpointAgeMs: 60_000 });
  const oldButWithinWindow = NOW - 30_000;
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 5, lastCheckpointTimestampMs: oldButWithinWindow }),
    makeCandidate({ executionId: "e2", priority: 3, lastCheckpointTimestampMs: OLD_CHECKPOINT_MS }), // 10 min old - too old
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e1");
});

test("PreemptionService respects minPreemptablePriority [preemption-service]", () => {
  const service = new PreemptionService({ minPreemptablePriority: 20 });
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 10 }), // below threshold
    makeCandidate({ executionId: "e2", priority: 25 }),
    makeCandidate({ executionId: "e3", priority: 50 }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e2");
});

test("PreemptionService respects maxProtectedPriority [preemption-service]", () => {
  const service = new PreemptionService({ maxProtectedPriority: 60 });
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 50 }),
    makeCandidate({ executionId: "e2", priority: 70 }), // above protected threshold - filtered
    makeCandidate({ executionId: "e3", priority: 30 }),
  ];

  const result = service.selectVictim(candidates);

  // e3 (priority 30) is lowest among valid candidates (e2 filtered out at 70 > 60)
  assert.equal(result.victim?.executionId, "e3");
});

test("PreemptionService uses checkpointLatencyMs as final tiebreaker [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 5, progressPercent: 50, checkpointLatencyMs: 100 }),
    makeCandidate({ executionId: "e2", priority: 5, progressPercent: 50, checkpointLatencyMs: 500 }),
    makeCandidate({ executionId: "e3", priority: 5, progressPercent: 50, checkpointLatencyMs: 300 }),
  ];

  const result = service.selectVictim(candidates);

  // Higher checkpointLatencyMs wins the tie
  assert.equal(result.victim?.executionId, "e2");
});

test("PreemptionService static chooseVictim delegates to choosePreemptionVictim [preemption-service]", () => {
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 10 }),
    makeCandidate({ executionId: "e2", priority: 5 }),
  ];

  const victim = PreemptionService.chooseVictim(candidates, 300_000);

  assert.equal(victim?.executionId, "e2");
});

test("PreemptionService static chooseVictim returns null for empty array [preemption-service]", () => {
  const victim = PreemptionService.chooseVictim([]);
  assert.equal(victim, null);
});

test("PreemptionService applies default options [preemption-service]", () => {
  const service = new PreemptionService();
  // Default maxCheckpointAgeMs is 300_000, minPreemptablePriority is 0, maxProtectedPriority is 100
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", priority: 50, lastCheckpointTimestampMs: OLD_CHECKPOINT_MS }), // stale checkpoint
    makeCandidate({ executionId: "e2", priority: 101, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }), // above max protected
    makeCandidate({ executionId: "e3", priority: -1, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }), // below min preemptable
    makeCandidate({ executionId: "e4", priority: 50, lastCheckpointTimestampMs: 0 }), // no checkpoint
    makeCandidate({ executionId: "e5", priority: 50, protectedFromPreemption: true }), // protected
    makeCandidate({ executionId: "e6", priority: 30, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }), // valid
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.victim?.executionId, "e6");
  // eligibleCandidates = non-protected = e1,e2,e3,e4,e6 = 5
  // filteredCount = candidates.length - eligibleCandidates = 6 - 5 = 1 (only e5 is protected)
  // But note: only e6 passes all filter criteria (checkpoint, priority thresholds)
  assert.equal(result.eligibleCandidates, 5);
  assert.equal(result.filteredCount, 1);
});

test("PreemptionService handles candidates at priority boundaries [preemption-service]", () => {
  const service = new PreemptionService({ minPreemptablePriority: 0, maxProtectedPriority: 100 });
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e0", priority: 0, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
    makeCandidate({ executionId: "e100", priority: 100, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
    makeCandidate({ executionId: "e50", priority: 50, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS }),
  ];

  const result = service.selectVictim(candidates);

  // Lowest priority is 0 (highest actual priority for preemption)
  assert.equal(result.victim?.executionId, "e0");
});

test("PreemptionService returns correct eligibleCandidates count [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1", protectedFromPreemption: true }),
    makeCandidate({ executionId: "e2" }),
    makeCandidate({ executionId: "e3", protectedFromPreemption: true }),
    makeCandidate({ executionId: "e4" }),
  ];

  const result = service.selectVictim(candidates);

  assert.equal(result.eligibleCandidates, 2);
  assert.equal(result.filteredCount, 2);
});

test("PreemptionService does not mutate candidates array [preemption-service]", () => {
  const service = new PreemptionService();
  const candidates: PreemptionCandidate[] = [
    makeCandidate({ executionId: "e1" }),
  ];

  service.selectVictim(candidates);

  assert.equal(candidates[0]?.executionId, "e1");
});
