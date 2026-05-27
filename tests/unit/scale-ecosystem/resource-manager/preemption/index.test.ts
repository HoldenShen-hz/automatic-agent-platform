import assert from "node:assert/strict";
import test from "node:test";
import { choosePreemptionVictim, type PreemptionCandidate } from "../../../../../src/scale-ecosystem/resource-manager/preemption/index.js";

const RECENT_CHECKPOINT_MS = Date.now() - 1_000;

test("choosePreemptionVictim returns lowest priority candidate [index]", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "e1", priority: 3, progressPercent: 50, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
    { executionId: "e2", priority: 1, progressPercent: 30, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
    { executionId: "e3", priority: 2, progressPercent: 80, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "e2"); // priority 1 is lowest
});

test("choosePreemptionVictim breaks ties by higher progress percent [index]", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "e1", priority: 1, progressPercent: 80, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
    { executionId: "e2", priority: 1, progressPercent: 30, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
    { executionId: "e3", priority: 1, progressPercent: 50, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "e1"); // higher progress wins at same priority
});

test("choosePreemptionVictim returns null for empty array [index]", () => {
  const result = choosePreemptionVictim([]);

  assert.equal(result, null);
});

test("choosePreemptionVictim returns null for single candidate [index]", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "only", priority: 5, progressPercent: 50, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result?.executionId, "only");
});

test("choosePreemptionVictim does not mutate original array [index]", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "e1", priority: 1, progressPercent: 50, lastCheckpointTimestampMs: RECENT_CHECKPOINT_MS },
  ];

  choosePreemptionVictim(candidates);

  assert.equal(candidates[0]?.executionId, "e1");
});
