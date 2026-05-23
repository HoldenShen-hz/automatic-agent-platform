import assert from "node:assert/strict";
import test from "node:test";

import type {
  ArtifactRef,
  ArtifactRecord,
  TaskRecord,
  WorkflowStateRecord,
  StepOutputRecord,
  CostEventRecord,
  MemoryKind,
  MemoryStatus,
  MemoryRecord,
  SessionSummaryRecord,
} from "../../../../../../src/platform/contracts/types/domain/task-types.js";
import type { TaskStatus, WorkflowStatus } from "../../../../../../src/platform/contracts/types/status.js";
import type { TaskPriority, TaskSource, BudgetScope, MemoryLayer, MemorySourceTrustLevel } from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("ArtifactRef structure is correct", () => {
  const ref: ArtifactRef = {
    artifactId: "artifact_123",
    kind: "file",
    uri: "file:///path/to/artifact",
    mimeType: "text/plain",
    sizeBytes: 1024,
    checksum: "abc123",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(ref.artifactId, "artifact_123");
  assert.equal(ref.mimeType, "text/plain");
});

test("ArtifactRef allows optional fields", () => {
  const ref: ArtifactRef = {
    artifactId: "artifact_456",
    kind: "image",
    uri: "file:///path/to/image.png",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(ref.mimeType, undefined);
  assert.equal(ref.checksum, undefined);
});

test("ArtifactRecord structure is correct", () => {
  const record: ArtifactRecord = {
    artifactId: "artifact_789",
    taskId: "task_123",
    executionId: "exec_456",
    stepId: "step_1",
    kind: "file",
    storagePath: "/artifacts/789.txt",
    fileName: "output.txt",
    mimeType: "text/plain",
    sizeBytes: 2048,
    checksum: "def456",
    lineageJson: '{"parent":"artifact_111"}',
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.taskId, "task_123");
  assert.equal(record.sizeBytes, 2048);
});

test("ArtifactRecord allows null executionId and stepId", () => {
  const record: ArtifactRecord = {
    artifactId: "artifact_minimal",
    taskId: "task_123",
    executionId: null,
    stepId: null,
    kind: "file",
    storagePath: "/artifacts/minimal.txt",
    fileName: "minimal.txt",
    mimeType: "text/plain",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.executionId, null);
  assert.equal(record.checksum, null);
});

test("TaskRecord structure is correct", () => {
  const record: TaskRecord = {
    id: "task_123",
    parentId: null,
    rootId: "task_123",
    divisionId: "division_1",
    title: "Test Task",
    status: "done",
    source: "user",
    priority: "normal",
    inputJson: '{"query":"test"}',
    normalizedInputJson: '{"query":"test"}',
    outputJson: '{"result":"success"}',
    estimatedCostUsd: 0.05,
    actualCostUsd: 0.04,
    errorCode: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:01:00.000Z",
    completedAt: "2026-04-14T00:01:30.000Z",
  };
  assert.equal(record.status, "done");
  assert.equal(record.priority, "normal");
});

test("TaskRecord allows null parentId and divisionId", () => {
  const record: TaskRecord = {
    id: "task_456",
    parentId: "task_789",
    rootId: "task_123",
    divisionId: null,
    title: "Subtask",
    status: "in_progress",
    source: "system",
    priority: "high",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    completedAt: null,
  };
  assert.equal(record.parentId, "task_789");
  assert.equal(record.normalizedInputJson, null);
});

test("WorkflowStateRecord structure is correct", () => {
  const record: WorkflowStateRecord = {
    taskId: "task_123",
    divisionId: "division_1",
    workflowId: "workflow_1",
    currentStepIndex: 2,
    status: "running",
    outputsJson: '{"step1":"out1","step2":"out2"}',
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:05:00.000Z",
  };
  assert.equal(record.currentStepIndex, 2);
  assert.equal(record.status, "running");
});

test("WorkflowStateRecord allows error and retry", () => {
  const record: WorkflowStateRecord = {
    taskId: "task_456",
    divisionId: "division_1",
    workflowId: "workflow_1",
    currentStepIndex: 1,
    status: "running",
    outputsJson: "{}",
    lastErrorCode: "step_timeout",
    retryCount: 2,
    resumableFromStep: "step_2",
    startedAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:03:00.000Z",
  };
  assert.equal(record.lastErrorCode, "step_timeout");
  assert.equal(record.retryCount, 2);
});

test("StepOutputRecord structure is correct", () => {
  const record: StepOutputRecord = {
    id: "stepout_123",
    taskId: "task_123",
    nodeRunId: "node_run_123",
    stepId: "step_1",
    roleId: "executor",
    status: "succeeded",
    dataJson: '{"result":"success"}',
    summary: "Step completed successfully",
    artifactsJson: null,
    tokenCost: 1500,
    durationMs: 5000,
    validationJson: null,
    producedAt: "2026-04-14T00:05:00.000Z",
  };
  assert.equal(record.status, "succeeded");
  assert.equal(record.tokenCost, 1500);
});

test("StepOutputRecord status accepts all valid values", () => {
  const statuses: StepOutputRecord["status"][] = ["succeeded", "failed", "partial_success", "skipped"];
  assert.equal(statuses.length, 4);
});

test("StepOutputRecord allows null summary and artifactsJson", () => {
  const record: StepOutputRecord = {
    id: "stepout_456",
    taskId: "task_123",
    nodeRunId: "node_run_456",
    stepId: "step_2",
    roleId: "reviewer",
    status: "failed",
    dataJson: '{"error":"timeout"}',
    summary: null,
    artifactsJson: null,
    tokenCost: 500,
    durationMs: 30000,
    validationJson: null,
    producedAt: "2026-04-14T00:05:00.000Z",
  };
  assert.equal(record.summary, null);
  assert.equal(record.artifactsJson, null);
});

test("CostEventRecord structure is correct", () => {
  const record: CostEventRecord = {
    id: "cost_123",
    taskId: "task_456",
    sessionId: "sess_789",
    executionId: "exec_abc",
    agentId: "agent_def",
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.02,
    budgetScope: "task_execution",
    providerRequestId: "req_123",
    pricingVersion: "2024-01",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.provider, "anthropic");
  assert.equal(record.costUsd, 0.02);
});

test("CostEventRecord allows null optional fields", () => {
  const record: CostEventRecord = {
    id: "cost_456",
    taskId: "task_789",
    sessionId: null,
    executionId: null,
    agentId: null,
    provider: "openai",
    model: "gpt-4",
    inputTokens: 500,
    outputTokens: 250,
    costUsd: 0.01,
    budgetScope: "compaction",
    providerRequestId: null,
    pricingVersion: null,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.sessionId, null);
  assert.equal(record.providerRequestId, null);
});

test("MemoryKind accepts all valid values", () => {
  const kinds: MemoryKind[] = ["general", "fact", "episode", "rule", "decision"];
  assert.equal(kinds.length, 5);
});

test("MemoryStatus accepts all valid values", () => {
  const statuses: MemoryStatus[] = ["active", "archived", "superseded"];
  assert.equal(statuses.length, 3);
});

test("MemoryRecord structure is correct", () => {
  const record: MemoryRecord = {
    id: "mem_123",
    taskId: "task_456",
    sessionId: "sess_789",
    agentId: "agent_abc",
    executionId: "exec_def",
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: '{"text":"Important fact"}',
    classification: "fact",
    sourceTrustLevel: "trusted",
    qualityScore: 0.9,
    hitCount: 5,
    createdAt: "2026-04-14T00:00:00.000Z",
    lastAccessedAt: "2026-04-14T00:30:00.000Z",
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "fact",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.7,
    contentHash: "abc123def456",
  };
  assert.equal(record.memoryLayer, "layer_3");
  assert.equal(record.qualityScore, 0.9);
});

test("MemoryRecord allows null optional fields", () => {
  const record: MemoryRecord = {
    id: "mem_minimal",
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "persistent",
    contentJson: "{}",
    classification: "general",
    sourceTrustLevel: "external",
    qualityScore: null,
    hitCount: 0,
    createdAt: "2026-04-14T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
  };
  assert.equal(record.taskId, null);
  assert.equal(record.qualityScore, null);
  assert.equal(record.expiresAt, null);
});

test("SessionSummaryRecord structure is correct", () => {
  const record: SessionSummaryRecord = {
    id: "summary_123",
    sessionId: "sess_456",
    taskId: "task_789",
    agentId: "agent_abc",
    summaryText: "Completed task successfully",
    keyDecisions: "Chose option A",
    keyOutcomes: "Task completed on time",
    memoryIdsReferenced: '["mem_1","mem_2"]',
    tokenCount: 5000,
    createdAt: "2026-04-14T00:30:00.000Z",
  };
  assert.equal(record.summaryText, "Completed task successfully");
  assert.equal(record.tokenCount, 5000);
});

test("SessionSummaryRecord allows null optional fields", () => {
  const record: SessionSummaryRecord = {
    id: "summary_minimal",
    sessionId: "sess_123",
    taskId: null,
    agentId: null,
    summaryText: "Brief summary",
    keyDecisions: null,
    keyOutcomes: null,
    memoryIdsReferenced: null,
    tokenCount: null,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.taskId, null);
  assert.equal(record.keyDecisions, null);
});
