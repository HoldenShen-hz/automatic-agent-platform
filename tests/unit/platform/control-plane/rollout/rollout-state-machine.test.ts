/**
 * Unit Tests: Rollout State Machine
 *
 * Tests the RolloutStateMachine class that manages state transitions
 * for progressive rollouts through stages (draft → shadow → canary_5 → ... → stable).
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RolloutStateMachine } from "../../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { RolloutLevel, RolloutRecord, RolloutStatus } from "../../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate_test_1",
    taskId: "task_test_1",
    sourceSignalRefs: [],
    sourceLearningObjectIds: [],
    changeScope: "policy",
    description: "Test candidate for rollout state machine",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  } as unknown as ImprovementCandidate;
}

describe("RolloutStateMachine", () => {
  describe("transition", () => {
    test("creates valid rollout record for shadow transition", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "shadow");

      assert.equal(record.candidateId, candidate.candidateId);
      assert.equal(record.level, "shadow");
      assert.equal(record.previousLevel, "off");
      assert.equal(record.status, "shadow");
      assert.ok(record.recordId.length > 0);
      assert.ok(record.transitionedAt > 0);
    });

    test("throws error for invalid transition from draft to stable", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "proposed" });

      assert.throws(
        () => stateMachine.transition(candidate, "stable"),
        /Invalid rollout transition/,
      );
    });

    test("allows transition from shadow to canary_5", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "shadow_running" });

      const record = stateMachine.transition(candidate, "canary_5");

      assert.equal(record.level, "canary_5");
      assert.equal(record.previousLevel, "shadow");
      assert.equal(record.status, "canary_5");
    });

    test("allows transition from canary_5 to partial_25", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "shadow_running" });

      const record = stateMachine.transition(candidate, "partial_25");

      assert.equal(record.level, "partial_25");
      assert.equal(record.previousLevel, "shadow");
    });

    test("allows transition from partial_75 to stable", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "stable");

      assert.equal(record.level, "stable");
    });

    test("throws error for rejected candidate transitioning to shadow", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "rejected" });

      assert.throws(
        () => stateMachine.transition(candidate, "shadow"),
        /Invalid rollout transition/,
      );
    });

    test("accepts approvedBy option in transition", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "shadow", {
        approvedBy: "admin_user",
      });

      assert.equal(record.approvedBy, "admin_user");
    });

    test("accepts guardrailReasonCodes option in transition", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });
      const reasonCodes = ["guardrail_001", "guardrail_002"];

      const record = stateMachine.transition(candidate, "shadow", {
        guardrailReasonCodes: reasonCodes,
      });

      assert.deepEqual(record.guardrailReasonCodes, reasonCodes);
    });

    test("accepts strategyVersionId option in transition", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "shadow", {
        strategyVersionId: "v2.0.0",
      });

      assert.equal(record.strategyVersionId, "v2.0.0");
    });

    test("uses custom currentStatus when provided", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "canary_5", {
        currentStatus: "shadow",
      });

      assert.equal(record.level, "canary_5");
      assert.equal(record.previousLevel, "shadow");
    });

    test("uses custom targetStatus when provided", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "shadow", {
        targetStatus: "shadow",
      });

      assert.equal(record.status, "shadow");
    });

    test("populates evidence from candidate sourceSignalRefs", () => {
      const signalRefs = ["signal_1", "signal_2"];
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({
        status: "approved",
        sourceSignalRefs: signalRefs,
      });

      const record = stateMachine.transition(candidate, "shadow");

      assert.deepEqual(record.evidence, signalRefs);
    });

    test("rejected status is terminal (only rejects allowed)", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "rejected" });

      const record = stateMachine.transition(candidate, "off");

      assert.equal(record.status, "rejected");
      assert.equal(record.level, "off");
    });

    test("rolled_back status is terminal", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "rolled_back" });

      const record = stateMachine.transition(candidate, "off");

      assert.equal(record.status, "rolled_back");
      assert.equal(record.level, "off");
    });

    test("paused status allows transitions to most stages", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      // Transition to paused first
      const pausedRecord = stateMachine.transition(candidate, "shadow", {
        targetStatus: "paused",
      });
      assert.equal(pausedRecord.status, "paused");

      // Then transition from paused to shadow
      const resumedRecord = stateMachine.transition(candidate, "shadow", {
        currentStatus: "paused",
      });
      assert.equal(resumedRecord.status, "shadow");
    });
  });

  describe("valid transitions map", () => {
    test("draft allows transition to pending_approval", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "proposed" });

      const record = stateMachine.transition(candidate, "suggest");

      assert.equal(record.status, "pending_approval");
    });

    test("draft allows transition to shadow", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "proposed" });

      const record = stateMachine.transition(candidate, "shadow");

      assert.equal(record.status, "shadow");
    });

    test("partial_25 allows transition to partial_50", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "partial_50");

      assert.equal(record.level, "partial_50");
      assert.equal(record.status, "partial_50");
    });

    test("partial_50 allows transition to partial_75", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "partial_75");

      assert.equal(record.level, "partial_75");
    });

    test("stable status returns stable in level", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "approved" });

      const record = stateMachine.transition(candidate, "stable");

      assert.equal(record.level, "stable");
      assert.equal(record.status, "stable");
    });

    test("draft allows transition to rejected", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "proposed" });

      const record = stateMachine.transition(candidate, "off", {
        targetStatus: "rejected",
      });

      assert.equal(record.status, "rejected");
    });

    test("draft allows transition to rolled_back", () => {
      const stateMachine = new RolloutStateMachine();
      const candidate = createMockCandidate({ status: "proposed" });

      const record = stateMachine.transition(candidate, "off", {
        targetStatus: "rolled_back",
      });

      assert.equal(record.status, "rolled_back");
    });
  });
});
