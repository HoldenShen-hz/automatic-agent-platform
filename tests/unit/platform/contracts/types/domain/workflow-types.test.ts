import assert from "node:assert/strict";
import test from "node:test";

import type {
  CompensationPlanEntry,
  CompensationPlan,
  CheckpointPlanEntry,
  CheckpointPlan,
} from "../../../../../../src/platform/contracts/types/domain/workflow-types.js";

test("CompensationPlanEntry structure is correct", () => {
  const entry: CompensationPlanEntry = {
    stepId: "step_1",
    compensationModel: "idempotent_replay",
    triggerCondition: "step_failed",
    compensationOwner: "agent_alpha",
    compensationTimeoutMs: 30000,
    compensationIdempotent: true,
    evidenceArtifactKind: "compensation_log",
  };
  assert.equal(entry.stepId, "step_1");
  assert.equal(entry.compensationModel, "idempotent_replay");
  assert.equal(entry.compensationTimeoutMs, 30000);
  assert.equal(entry.compensationIdempotent, true);
});

test("CompensationPlanEntry allows compare_and_swap_write model", () => {
  const entry: CompensationPlanEntry = {
    stepId: "step_2",
    compensationModel: "compare_and_swap_write",
    triggerCondition: "downstream_cascade_failed",
    compensationOwner: "agent_beta",
    compensationTimeoutMs: 60000,
    compensationIdempotent: false,
    evidenceArtifactKind: "cas_evidence",
  };
  assert.equal(entry.compensationModel, "compare_and_swap_write");
  assert.equal(entry.compensationIdempotent, false);
});

test("CompensationPlanEntry allows compensating_action model", () => {
  const entry: CompensationPlanEntry = {
    stepId: "step_3",
    compensationModel: "compensating_action",
    triggerCondition: "step_timeout",
    compensationOwner: "agent_gamma",
    compensationTimeoutMs: 120000,
    compensationIdempotent: true,
    evidenceArtifactKind: "rollback_log",
  };
  assert.equal(entry.compensationModel, "compensating_action");
});

test("CompensationPlanEntry allows manual_reconciliation_required model", () => {
  const entry: CompensationPlanEntry = {
    stepId: "step_4",
    compensationModel: "manual_reconciliation_required",
    triggerCondition: "irreversible_action",
    compensationOwner: "human_operator",
    compensationTimeoutMs: 0,
    compensationIdempotent: false,
    evidenceArtifactKind: "manual_ticket",
  };
  assert.equal(entry.compensationModel, "manual_reconciliation_required");
});

test("CompensationPlan structure is correct", () => {
  const plan: CompensationPlan = {
    workflowId: "wf_123",
    divisionId: "div_456",
    entries: [
      {
        stepId: "step_1",
        compensationModel: "idempotent_replay",
        triggerCondition: "step_failed",
        compensationOwner: "agent",
        compensationTimeoutMs: 30000,
        compensationIdempotent: true,
        evidenceArtifactKind: "log",
      },
      {
        stepId: "step_2",
        compensationModel: "compensating_action",
        triggerCondition: "cascade_failed",
        compensationOwner: "agent",
        compensationTimeoutMs: 60000,
        compensationIdempotent: false,
        evidenceArtifactKind: "evidence",
      },
    ],
  };
  assert.equal(plan.workflowId, "wf_123");
  assert.equal(plan.entries.length, 2);
  assert.equal(plan.entries[0]?.stepId, "step_1");
});

test("CompensationPlan allows empty entries", () => {
  const plan: CompensationPlan = {
    workflowId: "wf_no_comp",
    divisionId: "div_no_comp",
    entries: [],
  };
  assert.equal(plan.entries.length, 0);
});

test("CheckpointPlanEntry structure is correct", () => {
  const entry: CheckpointPlanEntry = {
    afterStepId: "step_5",
    sideEffectBoundary: true,
    recoveryStrategy: "resume_from_checkpoint",
  };
  assert.equal(entry.afterStepId, "step_5");
  assert.equal(entry.sideEffectBoundary, true);
  assert.equal(entry.recoveryStrategy, "resume_from_checkpoint");
});

test("CheckpointPlanEntry allows replay_from_start strategy", () => {
  const entry: CheckpointPlanEntry = {
    afterStepId: "step_early",
    sideEffectBoundary: false,
    recoveryStrategy: "replay_from_start",
  };
  assert.equal(entry.recoveryStrategy, "replay_from_start");
  assert.equal(entry.sideEffectBoundary, false);
});

test("CheckpointPlanEntry allows manual_reconciliation strategy", () => {
  const entry: CheckpointPlanEntry = {
    afterStepId: "step_critical",
    sideEffectBoundary: true,
    recoveryStrategy: "manual_reconciliation",
  };
  assert.equal(entry.recoveryStrategy, "manual_reconciliation");
});

test("CheckpointPlan structure is correct", () => {
  const plan: CheckpointPlan = {
    workflowId: "wf_checkpoint",
    divisionId: "div_checkpoint",
    entries: [
      {
        afterStepId: "step_1",
        sideEffectBoundary: true,
        recoveryStrategy: "resume_from_checkpoint",
      },
      {
        afterStepId: "step_2",
        sideEffectBoundary: false,
        recoveryStrategy: "replay_from_start",
      },
      {
        afterStepId: "step_3",
        sideEffectBoundary: true,
        recoveryStrategy: "manual_reconciliation",
      },
    ],
  };
  assert.equal(plan.workflowId, "wf_checkpoint");
  assert.equal(plan.entries.length, 3);
  assert.equal(plan.entries[0]?.recoveryStrategy, "resume_from_checkpoint");
});

test("CheckpointPlan allows empty entries", () => {
  const plan: CheckpointPlan = {
    workflowId: "wf_no_checkpoints",
    divisionId: "div_no_checkpoints",
    entries: [],
  };
  assert.equal(plan.entries.length, 0);
});
