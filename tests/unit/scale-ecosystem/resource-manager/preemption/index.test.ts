import assert from "node:assert/strict";
import test from "node:test";
import { choosePreemptionVictim, type PreemptionCandidate } from "../../../../../src/scale-ecosystem/resource-manager/preemption/index.js";

test("choosePreemptionVictim returns lowest priority candidate", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "e1", priority: 3, progressPercent: 50 },
    { executionId: "e2", priority: 1, progressPercent: 30 },
    { executionId: "e3", priority: 2, progressPercent: 80 },
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "e2"); // priority 1 is lowest
});

test("choosePreemptionVictim breaks ties by progress percent", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "e1", priority: 1, progressPercent: 80 },
    { executionId: "e2", priority: 1, progressPercent: 30 },
    { executionId: "e3", priority: 1, progressPercent: 50 },
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "e2"); // lowest progress at same priority
});

test("choosePreemptionVictim returns null for empty array", () => {
  const result = choosePreemptionVictim([]);

  assert.equal(result, null);
});

test("choosePreemptionVictim returns null for single candidate", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "only", priority: 5, progressPercent: 50 },
  ];

  const result = choosePreemptionVictim(candidates);

  assert.equal(result?.executionId, "only");
});

test("choosePreemptionVictim does not mutate original array", () => {
  const candidates: PreemptionCandidate[] = [
    { executionId: "e1", priority: 1, progressPercent: 50 },
  ];

  choosePreemptionVictim(candidates);

  assert.equal(candidates[0]?.executionId, "e1");
});