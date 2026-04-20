import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";

function createCandidate(status: ImprovementCandidate["status"]): ImprovementCandidate {
  return {
    candidateId: `candidate_${status}`,
    taskId: "task_rollout",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["learning_1"],
    changeScope: "policy",
    description: "rollout candidate",
    expectedBenefit: "safer progressive promotion",
    status,
    createdAt: Date.now(),
  };
}

test("RolloutStateMachine promotes approved candidates into the pending approval lane", () => {
  const stateMachine = new RolloutStateMachine();
  const record = stateMachine.transition(createCandidate("approved"), "suggest", {
    approvedBy: "operator",
  });

  assert.equal(record.previousLevel, "suggest");
  assert.equal(record.level, "suggest");
  assert.equal(record.status, "pending_approval");
});

test("RolloutStateMachine allows progressive promotion from shadow to stable lanes", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const canary = stateMachine.transition(candidate, "canary_5");
  assert.equal(canary.previousLevel, "shadow");
  assert.equal(canary.status, "canary_5");

  const partial = stateMachine.transition(candidate, "partial_25", {
    currentStatus: "canary_5",
  });
  assert.equal(partial.previousLevel, "canary_5");
  assert.equal(partial.status, "partial_25");

  const stable = stateMachine.transition(candidate, "stable", {
    currentStatus: "partial_75",
  });
  assert.equal(stable.previousLevel, "partial_75");
  assert.equal(stable.status, "stable");
});

test("RolloutStateMachine rejects invalid transitions", () => {
  const stateMachine = new RolloutStateMachine();
  assert.throws(
    () => stateMachine.transition(createCandidate("approved"), "partial_25"),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine allows rejected state self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("rejected");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "rejected",
    targetStatus: "rejected",
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine infers rejected status from candidate when currentStatus not provided", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("rejected");
  candidate.sourceSignalRefs = ["sig_rejected_1", "sig_rejected_2"];

  // Do NOT provide currentStatus - let inferCurrentStatus be called
  const result = stateMachine.transition(candidate, "off", {
    targetStatus: "rejected",
    strategyVersionId: "v123",
    approvedBy: "test-operator",
    guardrailReasonCodes: ["test_reason"],
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.level, "off");
  assert.equal(result.previousLevel, "off");
  assert.equal(result.strategyVersionId, "v123");
  assert.equal(result.approvedBy, "test-operator");
  assert.deepEqual(result.guardrailReasonCodes, ["test_reason"]);
  assert.deepEqual(result.evidence, ["sig_rejected_1", "sig_rejected_2"]);
});

test("RolloutStateMachine allows rolled_back state self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("rolled_back");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "rolled_back",
    targetStatus: "rolled_back",
  });

  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine infers rolled_back status from candidate when currentStatus not provided", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("rolled_back");
  candidate.sourceSignalRefs = ["sig_rb_1"];

  // Do NOT provide currentStatus - let inferCurrentStatus be called
  const result = stateMachine.transition(candidate, "off", {
    targetStatus: "rolled_back",
    strategyVersionId: "v456",
    approvedBy: "test-admin",
    guardrailReasonCodes: ["rollback_test"],
  });

  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
  assert.equal(result.previousLevel, "off");
  assert.equal(result.strategyVersionId, "v456");
  assert.equal(result.approvedBy, "test-admin");
  assert.deepEqual(result.guardrailReasonCodes, ["rollback_test"]);
  assert.deepEqual(result.evidence, ["sig_rb_1"]);
});

test("RolloutStateMachine allows paused to transition to shadow", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "shadow", {
    currentStatus: "paused",
    targetStatus: "shadow",
  });

  assert.equal(result.status, "shadow");
  assert.equal(result.level, "shadow");
});

test("RolloutStateMachine allows paused to transition to stable", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "stable", {
    currentStatus: "paused",
    targetStatus: "stable",
  });

  assert.equal(result.status, "stable");
  assert.equal(result.level, "stable");
});

test("RolloutStateMachine rejects draft to stable direct transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  assert.throws(
    () => stateMachine.transition(candidate, "stable", {
      currentStatus: "draft",
    }),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine allows pending_approval to shadow", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "shadow", {
    currentStatus: "pending_approval",
    targetStatus: "shadow",
  });

  assert.equal(result.status, "shadow");
});

test("RolloutStateMachine allows pending_approval to rejected", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "pending_approval",
    targetStatus: "rejected",
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows pending_approval to paused", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "pending_approval",
    targetStatus: "paused",
  });

  assert.equal(result.status, "paused");
});

test("RolloutStateMachine allows shadow to rolled_back", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "shadow",
    targetStatus: "rolled_back",
  });

  assert.equal(result.status, "rolled_back");
});

test("RolloutStateMachine allows canary_5 to paused", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "canary_5",
    targetStatus: "paused",
  });

  assert.equal(result.status, "paused");
});

test("RolloutStateMachine allows partial_50 to rolled_back", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "partial_50",
    targetStatus: "rolled_back",
  });

  assert.equal(result.status, "rolled_back");
});

test("RolloutStateMachine preserves guardrail reason codes", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "shadow", {
    guardrailReasonCodes: ["rollout.metrics_gate_failed", "rollout.latency_exceeded"],
  });

  assert.deepEqual(result.guardrailReasonCodes, ["rollout.metrics_gate_failed", "rollout.latency_exceeded"]);
});

test("RolloutStateMachine preserves evidence from candidate source signals", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");
  candidate.sourceSignalRefs = ["sig_1", "sig_2", "sig_3"];

  const result = stateMachine.transition(candidate, "suggest");

  assert.deepEqual(result.evidence, ["sig_1", "sig_2", "sig_3"]);
});

// =============================================================================
// Self-transition tests (stable, canary_5, partial statuses)
// =============================================================================

test("RolloutStateMachine allows stable self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  // First get to stable
  const stable = stateMachine.transition(candidate, "stable", {
    currentStatus: "partial_75",
    targetStatus: "stable",
  });
  assert.equal(stable.status, "stable");

  // Self-transition within stable
  const result = stateMachine.transition(candidate, "stable", {
    currentStatus: "stable",
    targetStatus: "stable",
  });
  assert.equal(result.status, "stable");
  assert.equal(result.level, "stable");
});

test("RolloutStateMachine allows canary_5 self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "canary_5", {
    currentStatus: "canary_5",
    targetStatus: "canary_5",
  });
  assert.equal(result.status, "canary_5");
});

test("RolloutStateMachine allows partial_25 self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "partial_25", {
    currentStatus: "partial_25",
    targetStatus: "partial_25",
  });
  assert.equal(result.status, "partial_25");
});

test("RolloutStateMachine allows partial_50 self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "partial_50", {
    currentStatus: "partial_50",
    targetStatus: "partial_50",
  });
  assert.equal(result.status, "partial_50");
});

test("RolloutStateMachine allows partial_75 self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "partial_75", {
    currentStatus: "partial_75",
    targetStatus: "partial_75",
  });
  assert.equal(result.status, "partial_75");
});

test("RolloutStateMachine allows pending_approval self-transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "pending_approval",
    targetStatus: "pending_approval",
  });
  assert.equal(result.status, "pending_approval");
});

// =============================================================================
// paused transitions
// =============================================================================

test("RolloutStateMachine paused status maps to suggest level (returns to pending_approval)", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  // paused -> pending_approval (via suggest level)
  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "paused",
    targetStatus: "pending_approval",
  });
  assert.equal(result.status, "pending_approval");
});

test("RolloutStateMachine allows draft to rejected transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "draft",
    targetStatus: "rejected",
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows draft to rolled_back transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "draft",
    targetStatus: "rolled_back",
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows draft to pending_approval transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "draft",
    targetStatus: "pending_approval",
  });
  assert.equal(result.status, "pending_approval");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows draft to shadow transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "shadow", {
    currentStatus: "draft",
    targetStatus: "shadow",
  });
  assert.equal(result.status, "shadow");
  assert.equal(result.level, "shadow");
});

test("RolloutStateMachine allows draft to paused transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "draft",
    targetStatus: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows pending_approval to shadow transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "shadow", {
    currentStatus: "pending_approval",
    targetStatus: "shadow",
  });
  assert.equal(result.status, "shadow");
  assert.equal(result.level, "shadow");
});

test("RolloutStateMachine allows shadow to paused transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "shadow",
    targetStatus: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows canary_5 to partial_25 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "partial_25", {
    currentStatus: "canary_5",
    targetStatus: "partial_25",
  });
  assert.equal(result.status, "partial_25");
  assert.equal(result.level, "partial_25");
});

test("RolloutStateMachine allows canary_5 to rolled_back transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "canary_5",
    targetStatus: "rolled_back",
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows partial_25 to partial_50 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "partial_50", {
    currentStatus: "partial_25",
    targetStatus: "partial_50",
  });
  assert.equal(result.status, "partial_50");
  assert.equal(result.level, "partial_50");
});

test("RolloutStateMachine allows partial_25 to rolled_back transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "partial_25",
    targetStatus: "rolled_back",
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows partial_25 to paused transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "partial_25",
    targetStatus: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows partial_50 to partial_75 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "partial_75", {
    currentStatus: "partial_50",
    targetStatus: "partial_75",
  });
  assert.equal(result.status, "partial_75");
  assert.equal(result.level, "partial_75");
});

test("RolloutStateMachine allows partial_50 to paused transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "partial_50",
    targetStatus: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows partial_75 to stable transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "stable", {
    currentStatus: "partial_75",
    targetStatus: "stable",
  });
  assert.equal(result.status, "stable");
  assert.equal(result.level, "stable");
});

test("RolloutStateMachine allows partial_75 to rolled_back transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "partial_75",
    targetStatus: "rolled_back",
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows partial_75 to paused transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "partial_75",
    targetStatus: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows stable to rolled_back transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "stable",
    targetStatus: "rolled_back",
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("RolloutStateMachine allows stable to paused transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("shadow_running");

  const result = stateMachine.transition(candidate, "suggest", {
    currentStatus: "stable",
    targetStatus: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.level, "suggest");
});

test("RolloutStateMachine allows paused to canary_5 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "canary_5", {
    currentStatus: "paused",
    targetStatus: "canary_5",
  });
  assert.equal(result.status, "canary_5");
  assert.equal(result.level, "canary_5");
});

test("RolloutStateMachine allows paused to partial_25 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "partial_25", {
    currentStatus: "paused",
    targetStatus: "partial_25",
  });
  assert.equal(result.status, "partial_25");
  assert.equal(result.level, "partial_25");
});

test("RolloutStateMachine allows paused to partial_50 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "partial_50", {
    currentStatus: "paused",
    targetStatus: "partial_50",
  });
  assert.equal(result.status, "partial_50");
  assert.equal(result.level, "partial_50");
});

test("RolloutStateMachine allows paused to partial_75 transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "partial_75", {
    currentStatus: "paused",
    targetStatus: "partial_75",
  });
  assert.equal(result.status, "partial_75");
  assert.equal(result.level, "partial_75");
});

test("RolloutStateMachine allows paused to rolled_back transition", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "off", {
    currentStatus: "paused",
    targetStatus: "rolled_back",
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});
