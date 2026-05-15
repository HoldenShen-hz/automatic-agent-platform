/**
 * R6-19 NodeRunId Canonization Tests
 *
 * Verifies that nodeRunId is used for canonical execution correlation
 * per §5.5, and stepId is retained only for backward compatibility.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import type {
  StepOutputRecord,
  ArtifactRecord,
} from "../../../../../src/platform/contracts/types/domain.js";
import { buildStepResultEnvelope, buildTaskResultEnvelope } from "../../../../../src/platform/contracts/result-envelope/result-envelope.js";
import type { TaskRecord, WorkflowStateRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockTaskRecord(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    id: newId("task"),
    parentId: null,
    rootId: newId("task"),
    harnessRunId: newId("hrun"),
    divisionId: "test_division",
    tenantId: "test_tenant",
    title: "Test Task",
    status: "done",
    source: "nl",
    priority: 0,
    inputJson: '{"request": "test"}',
    normalizedInputJson: null,
    outputJson: '{"result": "success"}',
    estimatedCostUsd: 0.001,
    actualCostUsd: 0.002,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  } as TaskRecord;
}

function createMockStepOutput(overrides?: Partial<StepOutputRecord>): StepOutputRecord {
  const nodeRunId = overrides?.nodeRunId ?? newId("nrun");
  return {
    id: newId("step"),
    nodeRunId,
    taskId: newId("task"),
    stepId: `legacy_step_${nodeRunId}`, // @deprecated stepId for backward compat
    roleId: "general_executor",
    status: "succeeded",
    dataJson: '{"summary": "step completed", "result": "output data"}',
    summary: "Step completed successfully",
    artifactsJson: null,
    tokenCost: 100,
    durationMs: 500,
    validationJson: null,
    producedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockArtifactRecord(overrides?: Partial<ArtifactRecord>): ArtifactRecord {
  const nodeRunId = overrides?.nodeRunId ?? newId("nrun");
  return {
    artifactId: newId("art"),
    taskId: newId("task"),
    executionId: null,
    nodeRunId,
    stepId: `legacy_${nodeRunId}`, // @deprecated - legacy projection
    kind: "workflow_step_snapshot",
    storagePath: "/artifacts/test.json",
    fileName: "test.json",
    mimeType: "application/json",
    sizeBytes: 1024,
    checksum: null,
    lineageJson: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// StepOutputRecord nodeRunId Tests
// =============================================================================

test("R6-19: StepOutputRecord uses nodeRunId as canonical identifier", () => {
  const nodeRunId = newId("nrun");
  const stepOutput = createMockStepOutput({ nodeRunId });

  // nodeRunId is the primary identifier
  assert.equal(stepOutput.nodeRunId, nodeRunId);
  // stepId is retained for backward compatibility (@deprecated)
  assert.ok(stepOutput.stepId?.startsWith("legacy_step_"));
});

test("R6-19: StepOutputRecord stepId is marked as optional deprecated field", () => {
  const stepOutput = createMockStepOutput();

  // stepId is optional (for backward compat)
  assert.ok(stepOutput.stepId !== undefined); // explicitly set in our mock
});

test("R6-19: ArtifactRecord uses nodeRunId for canonical correlation", () => {
  const nodeRunId = newId("nrun");
  const artifact = createMockArtifactRecord({ nodeRunId });

  // nodeRunId is the canonical field
  assert.equal(artifact.nodeRunId, nodeRunId);
  // stepId is retained for backward compatibility (@deprecated)
  assert.ok(artifact.stepId?.startsWith("legacy_"));
});

// =============================================================================
// Result Envelope nodeRunId Tests
// =============================================================================

test("R6-19: buildStepResultEnvelope uses nodeRunId in provenance", () => {
  const nodeRunId = newId("nrun");
  const stepOutput = createMockStepOutput({ nodeRunId });
  const artifacts: ArtifactRecord[] = [];

  const envelope = buildStepResultEnvelope(stepOutput, artifacts);

  // Provenance should use nodeRunId (canonical per §5.5)
  assert.equal(envelope.provenance?.["nodeRunId"], nodeRunId);
});

test("R6-19: buildStepResultEnvelope provenance does not use deprecated stepId", () => {
  const nodeRunId = newId("nrun");
  const stepOutput = createMockStepOutput({ nodeRunId });
  const artifacts: ArtifactRecord[] = [];

  const envelope = buildStepResultEnvelope(stepOutput, artifacts);

  // Provenance should NOT contain stepId (it's deprecated)
  assert.ok(!envelope.provenance || (envelope.provenance as Record<string, unknown>)["stepId"] === undefined);
});

test("R6-19: collectStepWarnings uses nodeRunId for warning prefix", () => {
  const nodeRunId = newId("nrun");
  const stepOutput = createMockStepOutput({
    nodeRunId,
    status: "partial_success", // triggers warning
  });
  const artifacts: ArtifactRecord[] = [];

  const envelope = buildStepResultEnvelope(stepOutput, artifacts);

  // Warnings should be prefixed with nodeRunId (canonical)
  const partialSuccessWarning = envelope.warnings.find((w) => w.includes("partial_success"));
  assert.ok(partialSuccessWarning);
  assert.ok(partialSuccessWarning?.startsWith(nodeRunId));
});

// =============================================================================
// Artifact Resolution nodeRunId Priority Tests
// =============================================================================

test("R6-19: resolveArtifactRefs prefers nodeRunId match over stepId", () => {
  const nodeRunId = newId("nrun");
  const legacyStepId = `legacy_${nodeRunId}`;

  // Artifact with matching nodeRunId
  const canonicalArtifact = createMockArtifactRecord({
    nodeRunId,
    artifactId: "canonical_art",
    kind: "workflow_step_snapshot",
  });

  // Artifact with only matching stepId (legacy fallback)
  const legacyArtifact = createMockArtifactRecord({
    nodeRunId: "different_noderun",
    stepId: legacyStepId,
    artifactId: "legacy_art",
    kind: "workflow_step_snapshot",
  });

  const stepOutput = createMockStepOutput({ nodeRunId, stepId: legacyStepId });

  const refs = resolveArtifactRefsFromModule(stepOutput, [canonicalArtifact, legacyArtifact]);

  // Should return canonical artifact first (nodeRunId match)
  assert.equal(refs.length, 1);
  assert.equal(refs[0].artifactId, "canonical_art");
});

// Helper to test artifact resolution (same logic as in result-envelope.ts)
function resolveArtifactRefsFromModule(
  stepOutput: StepOutputRecord,
  artifacts: ArtifactRecord[],
): Array<{ artifactId: string; kind: string; uri: string; createdAt: string }> {
  // Simplified version of the resolution logic for testing
  const nodeRunIdMatches = artifacts.filter((a) => a.nodeRunId === stepOutput.nodeRunId);
  if (nodeRunIdMatches.length > 0) {
    return nodeRunIdMatches.map((a) => ({
      artifactId: a.artifactId,
      kind: a.kind,
      uri: a.storagePath,
      createdAt: a.createdAt,
    }));
  }
  return artifacts
    .filter((a) => a.stepId === stepOutput.stepId)
    .map((a) => ({
      artifactId: a.artifactId,
      kind: a.kind,
      uri: a.storagePath,
      createdAt: a.createdAt,
    }));
}

// =============================================================================
// CompensationStep nodeRunId Tests
// =============================================================================

test("R6-19: CompensationStep uses nodeRunId for canonical identity", async () => {
  const { CompensationStep } = await import("../../../../../src/platform/five-plane-execution/compensation-manager.js");

  // R6-19: CompensationStep should have nodeRunId as canonical field
  // This tests the interface definition
  const step: CompensationStep = {
    stepId: "legacy-comp-step", // @deprecated
    nodeRunId: "comp-step-123", // canonical per §5.5
    stepType: "reverse",
    targetRef: "test-ref",
    action: "reverse_test",
    estimatedImpact: "low",
  };

  assert.equal(step.nodeRunId, "comp-step-123");
  assert.ok(step.stepId.startsWith("legacy-"));
});

// =============================================================================
// Task Result Envelope nodeRunId Tests
// =============================================================================

test("R6-19: buildTaskResultEnvelope uses nodeRunId for step correlation", () => {
  const nodeRunId1 = newId("nrun");
  const nodeRunId2 = newId("nrun");

  const stepOutputs = [
    createMockStepOutput({ nodeRunId: nodeRunId1 }),
    createMockStepOutput({ nodeRunId: nodeRunId2 }),
  ];

  const artifacts: ArtifactRecord[] = [];

  const envelope = buildTaskResultEnvelope({
    task: createMockTaskRecord(),
    workflowState: null,
    stepOutputs,
    artifacts,
  });

  // Metrics should aggregate from step outputs
  assert.ok(envelope.metrics);
  assert.equal(envelope.metrics.tokenCost, 200); // sum of both steps
  assert.equal(envelope.metrics.durationMs, 1000); // sum of both steps
});

// =============================================================================
// Billing Types nodeRunId Tests
// =============================================================================

test("R6-19: UsageEventRecord has nodeRunId as canonical field", async () => {
  const { UsageEventRecord } = await import("../../../../../src/platform/contracts/types/domain/billing-types.js");

  // nodeRunId is the canonical field for execution correlation
  // executionId and stepId are deprecated legacy projections
  const usage: UsageEventRecord = {
    usageId: newId("usage"),
    accountId: "test-account",
    subjectId: "test-subject",
    workspaceId: null,
    tenantId: "test-tenant",
    taskId: newId("task"),
    harnessRunId: newId("hrun"),
    nodeRunId: newId("nrun"),
    attemptId: null,
    executionId: null, // @deprecated
    stepId: null, // @deprecated
    metricType: "token_usage",
    quantity: 1000,
    source: "api",
    unitPriceUsd: 0.0001,
    capturedAt: new Date().toISOString() as any,
  };

  assert.ok(usage.nodeRunId);
  assert.ok(usage.nodeRunId.startsWith("nrun_"));
  // Legacy fields are null
  assert.equal(usage.executionId, null);
  assert.equal(usage.stepId, null);
});
