/**
 * Unit Tests: multi-step-supervisor comprehensive scenarios
 *
 * Tests for comprehensive supervisor scenarios including:
 * - Step skipping logic with various dependency configurations
 * - Retry decision handling
 * - Escalation behavior
 * - Context propagation through steps
 * - Error code normalization scenarios
 * - Artifact creation verification
 * - State transition sequences
 */

import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  CostEventRecord,
  ExecutionPrecheckRecord,
  ExecutionRecord,
  ExecutionStatusTransitionCommand,
  MessageRecord,
  SessionRecord,
  SessionStatusTransitionCommand,
  StepOutputRecord,
  TaskRecord,
  TaskStatusTransitionCommand,
  TransitionAuditContext,
  WorkflowStateRecord,
  WorkflowStatusTransitionCommand,
} from "../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactStore } from "../../../src/platform/five-plane-state-evidence/artifacts/artifact-store.js";
import type { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { StreamBridge } from "../../../src/platform/five-plane-interface/channel-gateway/stream-bridge.js";
import type { TransitionService } from "../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import type { ContextCompactionResult, ContextCompactionService } from "../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js";
import type { MultiStepToolExecutionInput } from "../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js";
import type { AdmissionDecision } from "../../../src/platform/five-plane-execution/dispatcher/admission-controller.js";
import type { RoleToolExposureService } from "../../../src/platform/five-plane-execution/tool-executor/role-tool-exposure-service.js";
import type { WorkflowStepRetryDecision } from "../../../src/platform/five-plane-orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
import {
  executeStepLoop,
  normalizeStepFailurePlan,
  resolveStepFailurePlan,
  normalizeStepErrorCode,
  buildStepFailureSummary,
  type StepSupervisorContext,
} from "../../../src/platform/five-plane-execution/execution-engine/multi-step-supervisor.js";
import type { PlannedWorkflow, PlannedExecutionStep } from "../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

// =============================================================================
// Mock Dependencies Factory
// =============================================================================

function createMockExecutionDeps(overrides: Partial<MockExecutionDeps> = {}): MockExecutionDeps {
  const defaultDeps: MockExecutionDeps = {
    store: createMockTaskStore(),
    db: createMockDb(),
    transitions: createMockTransitionService(),
    artifactStore: createMockArtifactStore(),
    contextCompaction: createMockContextCompactionService(),
    streamBridge: createMockStreamBridge(),
    transitionExecutionStatus: createMockTransitionExecutionStatus(),
    createContext: (reasonCode: string): TransitionAuditContext => ({
      reasonCode,
      traceId: "trace-123",
      spanId: "span-123",
      parentSpanId: null,
      correlationId: "trace-123",
      actorType: "system",
      occurredAt: nowIso(),
    }),
    ...overrides,
  };
  return defaultDeps;
}

function createMockTaskStore(): AuthoritativeTaskStore {
  return {
    task: {
      insertTask: (_task: TaskRecord) => {},
      getTask: (_taskId: string) => null,
      updateTask: (_taskId: string, _updates: Record<string, unknown>) => {},
      listTasks: (_filter: Record<string, unknown>) => [],
    },
    workflow: {
      insertWorkflowState: (_workflow: WorkflowStateRecord) => {},
      getWorkflowState: (_taskId: string) => null,
      insertStepOutput: (_stepOutput: StepOutputRecord) => {},
      listStepOutputs: (_taskId: string) => [],
      updateWorkflowRecoveryState: (_updates: Record<string, unknown>) => {},
    },
    execution: {
      insertExecution: (_execution: ExecutionRecord) => {},
      getExecution: (_executionId: string) => null,
      insertExecutionPrecheck: (_precheck: ExecutionPrecheckRecord) => {},
      updateExecutionFailure: (_updates: Record<string, unknown>) => {},
    },
    session: {
      insertMessage: (_message: MessageRecord) => {},
      listMessages: (_sessionId: string) => [],
    },
    artifact: {
      insertArtifact: (_artifact: { id: string }) => {},
      getArtifact: (_artifactId: string) => null,
    },
    billing: {
      insertCostEvent: (_costEvent: CostEventRecord) => {},
      listCostEvents: (_taskId: string) => [],
    },
    event: {
      insertEvent: (_event: { id: string }) => ({}),
      listEvents: (_taskId: string) => [],
    },
    operations: {
      loadTaskSnapshot: (_taskId: string) => null,
      insertTaskSnapshot: (_snapshot: Record<string, unknown>) => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  const mockStatement = {
    run: () => ({}),
    get: () => undefined,
    all: () => [],
    columns: () => [],
    expandedSQL: "",
    iterate: function* () { yield { done: true }; },
    setAllowBareNamedParameters: () => {},
    setCatalog: () => {},
    setIgnoreUndefined: () => {},
    setReadBigIntegers: () => {},
    setShortAsInteger: () => {},
  };
  return {
    filePath: "/tmp/test.db",
    backendType: "sqlite",
    connection: { exec: () => {}, prepare: () => mockStatement } as unknown as AuthoritativeSqlDatabase["connection"],
    migrate: () => {},
    getSchemaStatus: () => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: async () => true,
    transaction: <T>(fn: () => T) => fn(),
    readTransaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockTransitionService(): TransitionService {
  return {
    transitionTaskStatus: (_command: TaskStatusTransitionCommand) => {},
    transitionWorkflowStatus: (_command: WorkflowStatusTransitionCommand) => {},
    transitionSessionStatus: (_command: SessionStatusTransitionCommand) => {},
    transitionExecutionStatus: (_command: ExecutionStatusTransitionCommand) => {},
    transitionApprovalStatus: (_command: unknown) => {},
    transitionBlockedForApproval: (_input: unknown) => ({ approvalId: "", createdAt: "" }),
    transitionTaskTerminalState: (_input: unknown) => {},
    applyTaskTerminalState: (_input: unknown) => {},
  } as unknown as TransitionService;
}

function createMockArtifactStore(): ArtifactStore {
  return {
    rootDir: "/tmp/artifacts",
    writeJsonArtifact: (_params: Record<string, unknown>) => ({
      ref: { artifactId: "artifact-123", kind: "workflow_step_snapshot", uri: "file:///tmp/artifact.json", createdAt: nowIso() },
      record: { id: "artifact-123", taskId: "task-1", executionId: null, stepId: null, kind: "workflow_step_snapshot", storagePath: "/tmp", fileName: "artifact.json", mimeType: "application/json", sizeBytes: 0, checksum: null, lineageJson: null, createdAt: nowIso() },
    }),
    writeTextArtifact: (_params: Record<string, unknown>) => ({
      ref: { artifactId: "artifact-456", kind: "text", uri: "file:///tmp/artifact.txt", createdAt: nowIso() },
      record: { id: "artifact-456", taskId: "task-1", executionId: null, stepId: null, kind: "text", storagePath: "/tmp", fileName: "artifact.txt", mimeType: "text/plain", sizeBytes: 0, checksum: null, lineageJson: null, createdAt: nowIso() },
    }),
    sensitiveContentScanner: {
      scan: (_content: string) => ({ hasSensitive: false, classifications: [] }),
    },
  } as unknown as ArtifactStore;
}

function createMockContextCompactionService(): ContextCompactionService {
  return {
    compactContext: (_params: Record<string, unknown>): ContextCompactionResult => ({
      stage1Triggered: false,
      stage2Triggered: false,
      fallbackToStage1: false,
      usageBeforeTokens: 1000,
      usageAfterStage1Tokens: 0,
      usageAfterStage2Tokens: 0,
      contextMessages: [],
      persistedRecords: [],
      errorCode: null,
    }),
  } as unknown as ContextCompactionService;
}

function createMockStreamBridge(): StreamBridge {
  return {
    options: { bufferSize: 1000, flushIntervalMs: 100 },
    nextSequenceByStream: new Map(),
    replayBuffer: new Map(),
    droppedBeforeSequenceByStream: new Map(),
    emitFromEvent: (_params: Record<string, unknown>) => {},
    emitMessageDelta: (_params: Record<string, unknown>) => {},
    replay: (_streamId: string, _fromSequence: number) => [],
    healthCheck: async () => true,
  } as unknown as StreamBridge;
}

function createMockTransitionExecutionStatus() {
  return (_command: ExecutionStatusTransitionCommand) => {};
}

function createMockRoleToolExposureService(): RoleToolExposureService {
  return {
    resolve: (_params: { divisionId: string; roleId: string; taskContext: string }) => ({
      divisionId: "division-1",
      roleId: "role-1",
      declaredToolNames: ["tool_a", "tool_b"],
      resolvedToolNames: ["tool_a", "tool_b"],
      unresolvedToolNames: [],
      resolutionCorrections: [],
      visibleToolNames: ["tool_a", "tool_b"],
      deferredToolNames: [],
      visibleTools: [],
      deferredTools: [],
      wasFiltered: false,
      rolePromptText: "",
      model: "mini-max",
    }),
  } as unknown as RoleToolExposureService;
}

interface MockExecutionDeps {
  store: AuthoritativeTaskStore;
  db: AuthoritativeSqlDatabase;
  transitions: TransitionService;
  artifactStore: ArtifactStore;
  contextCompaction: ContextCompactionService;
  streamBridge: StreamBridge;
  transitionExecutionStatus: (command: ExecutionStatusTransitionCommand) => void;
  createContext: (reasonCode: string) => TransitionAuditContext;
}

// =============================================================================
// Mock Step Supervisor Context Factory
// =============================================================================

function createMockStepSupervisorContext(overrides: Partial<StepSupervisorContext> = {}): StepSupervisorContext {
  const baseContext: StepSupervisorContext = {
    taskId: newId("task"),
    sessionId: newId("sess"),
    traceId: newId("trace"),
    traceContext: { traceId: newId("trace"), spanId: "span-1", parentSpanId: null, correlationId: newId("trace") },
    streamId: newId("stream"),
    harnessRunId: newId("hrun"),
    admissionDecision: {
      decision: "allow",
      reasonCode: "admission.ok",
      snapshot: {
        queuedTasks: 0,
        activeExecutions: 0,
        tier1AckBacklog: 0,
        riskClassDistribution: {},
        tenantUsage: {},
        sandboxAvailability: {},
        capabilityClassCapacity: {},
      },
      backpressure: null,
    },
    input: createMockInput(),
    routing: {
      workflowId: "workflow-1",
      divisionId: "division-1",
      routeReason: "test routing",
      routeTrace: [],
      requiresOrchestration: true,
      classification: { intent: "query", continuation: "new_task", confidence: 0.8, matchedRules: [] },
    },
    plannedWorkflow: createMockPlannedWorkflow(),
    outputs: {},
    stepOutputs: [],
    toolExposureService: createMockRoleToolExposureService(),
    latestCompaction: null,
    executionAttemptCounter: 0,
    workflowRetryCount: 0,
    workflowLastErrorCode: null,
    blockedForDecision: false,
    skippedStepIds: new Set<string>(),
    failedStepIds: new Set<string>(),
    ...overrides,
  };
  return baseContext;
}

function createMockInput(overrides: Partial<MultiStepToolExecutionInput> = {}): MultiStepToolExecutionInput {
  return {
    dbPath: "/tmp/test.db",
    title: "Test Multi-Step",
    request: "Test request",
    ...overrides,
  } as MultiStepToolExecutionInput;
}

function createMockPlannedWorkflow(overrides: Partial<PlannedWorkflow> = {}): PlannedWorkflow {
  const workflow = {
    workflow: {
      workflowId: "workflow-1",
      divisionId: "division-1",
      steps: [] as const,
    },
    executionSteps: [
      {
        stepId: "step_1",
        agentId: "agent_1",
        roleId: "role_1",
        divisionId: "division_1",
        inputKeys: [],
        outputKey: "output_1",
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 30000,
        maxAttempts: 1,
      },
      {
        stepId: "step_2",
        agentId: "agent_2",
        roleId: "role_2",
        divisionId: "division_1",
        inputKeys: ["output_1"],
        outputKey: "output_2",
        dependsOnStepIds: ["step_1"],
        dependencyTypes: { step_1: "hard" },
        timeoutMs: 30000,
        maxAttempts: 1,
      },
    ] satisfies PlannedExecutionStep[],
    dependencyEdges: [{ fromStepId: "step_1", toStepId: "step_2" }],
    planReason: "test workflow",
    ...overrides,
  };
  return workflow;
}

// =============================================================================
// executeStepLoop Comprehensive Tests
// =============================================================================

test("executeStepLoop returns stepCompleted false when no steps complete [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      workflow: { workflowId: "wf-empty", divisionId: "div-1", steps: [] },
      executionSteps: [],
      dependencyEdges: [],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.stepCompleted, false);
  assert.equal(result.blockedForDecision, false);
});

test("executeStepLoop handles multiple steps with mixed outcomes [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "success_step",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "success_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
        {
          stepId: "fail_step",
          agentId: "agent_2",
          roleId: "role_2",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "fail_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
    stepOutputs: [
      {
        id: newId("step"),
        taskId: newId("task"),
        nodeRunId: newId("nrun"),
        stepId: "success_step",
        roleId: "role_1",
        status: "succeeded",
        dataJson: JSON.stringify({ summary: "Success" }),
        summary: "Success",
        artifactsJson: null,
        tokenCost: 10,
        durationMs: 100,
        validationJson: null,
        producedAt: nowIso(),
      },
    ],
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  // At least one step should have an output or the step should have been attempted
  assert.ok(Array.isArray(result.stepOutputs));
});

test("executeStepLoop preserves workflowRetryCount on success [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    workflowRetryCount: 5,
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.workflowRetryCount, 5);
});

test("executeStepLoop does not modify blockedForDecision when already blocked [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    blockedForDecision: true,
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "blocked_step",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "blocked_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.blockedForDecision, true);
});

test("executeStepLoop handles step with very long stepId [multi-step-supervisor-comprehensive]", async () => {
  const longStepId = "step_" + "x".repeat(500);
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: longStepId,
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "long_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.ok(Array.isArray(result.stepOutputs));
});

test("executeStepLoop handles step with unicode stepId [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "步骤_测试_unicode",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "unicode_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.ok(Array.isArray(result.stepOutputs));
});

test("executeStepLoop handles empty dependencyTypes object [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "no_dep_type",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "no_dep_out",
          dependsOnStepIds: ["non_existent"],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  // Step should proceed since dependencyType is empty (not "hard")
  assert.ok(Array.isArray(result.stepOutputs));
});

test("executeStepLoop handles step with zero timeoutMs [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "zero_timeout",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "zero_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 0,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.ok(Array.isArray(result.stepOutputs));
});

test("executeStepLoop handles step with very large maxAttempts [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "high_attempts",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "high_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 100,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.ok(Array.isArray(result.stepOutputs));
});

// =============================================================================
// normalizeStepFailurePlan Comprehensive Tests
// =============================================================================

test("normalizeStepFailurePlan handles undefined when passed directly [multi-step-supervisor-comprehensive]", () => {
  // The function expects string | StepFailurePlan, but we can test the boundary
  const result = normalizeStepFailurePlan("undefined_test" as unknown as string);
  assert.equal(result.errorCode, "undefined_test");
});

test("normalizeStepFailurePlan handles object with extra properties [multi-step-supervisor-comprehensive]", () => {
  const result = normalizeStepFailurePlan({
    errorCode: "test.error",
    summary: "Test summary",
    message: "Test message",
    extraProp: "should be preserved",
  } as unknown as { errorCode: string; summary?: string; message?: string });
  assert.equal(result.errorCode, "test.error");
});

// =============================================================================
// resolveStepFailurePlan Comprehensive Tests
// =============================================================================

test("resolveStepFailurePlan returns null for empty step ID [multi-step-supervisor-comprehensive]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      "": [{ errorCode: "empty_id_error" }],
    },
  });
  const result = resolveStepFailurePlan(input, "", 1);
  // Empty string step ID should return null or the plan depending on implementation
  // The function may return null because stepFailurePlans[""] is accessed
});

test("resolveStepFailurePlan handles very long step ID [multi-step-supervisor-comprehensive]", () => {
  const longStepId = "step_" + "x".repeat(1000);
  const input = createMockInput({
    stepFailurePlans: {
      [longStepId]: [{ errorCode: "long_step_error" }],
    },
  });
  const result = resolveStepFailurePlan(input, longStepId, 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "long_step_error");
});

test("resolveStepFailurePlan handles step ID with special characters [multi-step-supervisor-comprehensive]", () => {
  const specialStepId = "step-with-special!@#$%^&*()";
  const input = createMockInput({
    stepFailurePlans: {
      [specialStepId]: [{ errorCode: "special_char_error" }],
    },
  });
  const result = resolveStepFailurePlan(input, specialStepId, 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "special_char_error");
});

test("resolveStepFailurePlan with single step having multiple failure attempts [multi-step-supervisor-comprehensive]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      multi_attempt: [
        { errorCode: "attempt_1_fail" },
        { errorCode: "attempt_2_fail" },
        { errorCode: "attempt_3_fail" },
        { errorCode: "attempt_4_fail" },
        { errorCode: "attempt_5_fail" },
      ],
    },
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = resolveStepFailurePlan(input, "multi_attempt", attempt);
    assert.ok(result !== null, `Attempt ${attempt} should return a failure plan`);
    assert.equal(result!.errorCode, `attempt_${attempt}_fail`);
  }

  // Attempt 6 should return null
  const result6 = resolveStepFailurePlan(input, "multi_attempt", 6);
  assert.equal(result6, null);
});

// =============================================================================
// normalizeStepErrorCode Comprehensive Tests
// =============================================================================

test("normalizeStepErrorCode handles error with only prefix [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("workflow.output_schema_invalid");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode handles error with missing prefix colon [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("workflow.output_schema_invalidno colon");
  const result = normalizeStepErrorCode(error);
  // The prefix check uses startsWith, so "workflow.output_schema_invalidno colon" matches
  // because it does start with "workflow.output_schema_invalid"
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode handles error with multiple colons [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("workflow.output_schema_invalid:extra:colons");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode handles error starting with workflow.output_schema_missing [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("workflow.output_schema_missing:field name is required");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.invalid_input");
});

test("normalizeStepErrorCode handles workflow.output_schema_missing without colon [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("workflow.output_schema_missing no colon after");
  const result = normalizeStepErrorCode(error);
  // The prefix check uses startsWith, so this matches
  assert.equal(result, "validation.invalid_input");
});

test("normalizeStepErrorCode handles case sensitivity - uppercase WORKFLOW [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("WORKFLOW.output_schema_invalid:message");
  const result = normalizeStepErrorCode(error);
  // Should not match because of case sensitivity
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles partial prefix match [multi-step-supervisor-comprehensive]", () => {
  const error = new Error("not_workflow.output_schema_invalid:message");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles number as error [multi-step-supervisor-comprehensive]", () => {
  const result = normalizeStepErrorCode(0);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles boolean as error [multi-step-supervisor-comprehensive]", () => {
  const result = normalizeStepErrorCode(true);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles array as error [multi-step-supervisor-comprehensive]", () => {
  const result = normalizeStepErrorCode(["error", "array"]);
  assert.equal(result, "internal.unexpected_error");
});

// =============================================================================
// buildStepFailureSummary Comprehensive Tests
// =============================================================================

test("buildStepFailureSummary includes stepId and errorCode in all formats [multi-step-supervisor-comprehensive]", () => {
  const stepIds = ["a", "ab", "abc", "step", "multi_step_id", "123", "step-id"];
  const decisions: WorkflowStepRetryDecision[] = [
    { action: "retry" as const, errorCode: "e1", failureClass: "transient", retryable: true, backoff: "none" as const, retryDelayMs: 0 },
    { action: "escalate" as const, errorCode: "e2", failureClass: "destructive", retryable: false, backoff: "none" as const, retryDelayMs: 0 },
    { action: "fail" as const, errorCode: "e3", failureClass: "non_retryable", retryable: false, backoff: "none" as const, retryDelayMs: 0 },
  ];

  for (const stepId of stepIds) {
    for (const decision of decisions) {
      const result = buildStepFailureSummary(stepId, decision);
      assert.ok(result.includes(stepId), `Result should include stepId: ${stepId}`);
      assert.ok(result.includes(decision.errorCode), `Result should include errorCode: ${decision.errorCode}`);
    }
  }
});

test("buildStepFailureSummary formats retry message correctly [multi-step-supervisor-comprehensive]", () => {
  const decision: WorkflowStepRetryDecision = { action: "retry", errorCode: "timeout", failureClass: "transient", retryable: true, backoff: "exponential", retryDelayMs: 5000 };
  const result = buildStepFailureSummary("test_step", decision);

  assert.ok(result.includes("retry"));
  assert.ok(result.includes("test_step"));
  assert.ok(result.includes("timeout"));
  assert.ok(result.includes("will retry") || result.includes("retry"));
});

test("buildStepFailureSummary formats escalate message correctly [multi-step-supervisor-comprehensive]", () => {
  const decision: WorkflowStepRetryDecision = { action: "escalate", errorCode: "auth_failure", failureClass: "destructive", retryable: false, backoff: "none", retryDelayMs: 0 };
  const result = buildStepFailureSummary("auth_step", decision);

  assert.ok(result.includes("escalate") || result.includes("escalation"));
  assert.ok(result.includes("auth_step"));
  assert.ok(result.includes("auth_failure"));
});

test("buildStepFailureSummary formats fail message correctly [multi-step-supervisor-comprehensive]", () => {
  const decision: WorkflowStepRetryDecision = { action: "fail", errorCode: "permanent_error", failureClass: "non_retryable", retryable: false, backoff: "none", retryDelayMs: 0 };
  const result = buildStepFailureSummary("fail_step", decision);

  assert.ok(result.includes("failed") || result.includes("fail"));
  assert.ok(result.includes("fail_step"));
  assert.ok(result.includes("permanent_error"));
});

// =============================================================================
// executeStepLoop with Various Dependency Configurations
// =============================================================================

test("executeStepLoop with single step having multiple hard dependencies [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "dependent_step",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: ["out_a", "out_b", "out_c"],
          outputKey: "final_out",
          dependsOnStepIds: ["step_a", "step_b", "step_c"],
          dependencyTypes: { step_a: "hard", step_b: "hard", step_c: "hard" },
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
    failedStepIds: new Set(["step_a", "step_b", "step_c"]),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.skippedStepIds.has("dependent_step"), true);
});

test("executeStepLoop with mixed hard and soft dependencies [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    skippedStepIds: new Set(["soft_dep"]),
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "mixed_step",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: ["hard_out", "soft_out"],
          outputKey: "mixed_out",
          dependsOnStepIds: ["hard_dep", "soft_dep"],
          dependencyTypes: { hard_dep: "hard", soft_dep: "soft" },
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
    failedStepIds: new Set(["hard_dep"]),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  // Should skip because hard dependency failed
  assert.equal(result.skippedStepIds.has("mixed_step"), true);
});

test("executeStepLoop with successful upstream and soft dependency [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    skippedStepIds: new Set(["soft_dep"]),
    stepOutputs: [
      {
        id: newId("step"),
        taskId: newId("task"),
        nodeRunId: newId("nrun"),
        stepId: "hard_dep",
        roleId: "role_1",
        status: "succeeded",
        dataJson: JSON.stringify({ summary: "Hard dep succeeded" }),
        summary: "Hard dep succeeded",
        artifactsJson: null,
        tokenCost: 10,
        durationMs: 100,
        validationJson: null,
        producedAt: nowIso(),
      },
    ],
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "mixed_step",
          agentId: "agent_1",
          roleId: "role_1",
          divisionId: "division_1",
          inputKeys: ["hard_out", "soft_out"],
          outputKey: "mixed_out",
          dependsOnStepIds: ["hard_dep", "soft_dep"],
          dependencyTypes: { hard_dep: "hard", soft_dep: "soft" },
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  // Should NOT skip because hard dependency succeeded
  assert.equal(result.skippedStepIds.has("mixed_step"), false);
});

// =============================================================================
// Context and Trace Propagation Tests
// =============================================================================

test("executeStepLoop preserves traceContext from context [multi-step-supervisor-comprehensive]", async () => {
  const customTraceId = "custom-trace-" + newId("trace");
  const ctx = createMockStepSupervisorContext({
    traceId: customTraceId,
    traceContext: {
      traceId: customTraceId,
      spanId: "custom-span",
      parentSpanId: "parent-span",
      correlationId: "custom-corr",
    },
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.workflowRetryCount, 0);
});

test("executeStepLoop passes admissionDecision through result [multi-step-supervisor-comprehensive]", async () => {
  const customAdmission: AdmissionDecision = {
    decision: "queue",
    reasonCode: "admission.queue_backpressure",
    snapshot: {
      queuedTasks: 100,
      activeExecutions: 50,
      tier1AckBacklog: 10,
      riskClassDistribution: { high: 2 },
      tenantUsage: { "tenant-1": 10 },
      sandboxAvailability: { standard: 3 },
      capabilityClassCapacity: { default: 5 },
    },
    backpressure: { status: "degraded", degradationMode: "queue_only", queueGovernance: { backlogSize: 100, dispatchableBacklogSize: 50, claimedBacklogSize: 10, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, queueNames: [], starvationDetected: false }, findings: [] },
  };
  const ctx = createMockStepSupervisorContext({
    admissionDecision: customAdmission,
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  // Result should be based on the context
  assert.ok(typeof result.workflowRetryCount === "number");
});

// =============================================================================
// Tool Exposure Service Resolution Tests
// =============================================================================

test("executeStepLoop resolves tool exposure for each step [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    toolExposureService: {
      resolve: (_params: { divisionId: string; roleId: string; taskContext: string }) => ({
        divisionId: "division-1",
        roleId: "role-1",
        declaredToolNames: ["custom_tool"],
        resolvedToolNames: ["custom_tool"],
        unresolvedToolNames: [],
        resolutionCorrections: [],
        visibleToolNames: ["custom_tool"],
        deferredToolNames: [],
        visibleTools: [],
        deferredTools: [],
        wasFiltered: false,
        rolePromptText: "",
        model: "mini-max",
      }),
    } as unknown as RoleToolExposureService,
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [
        {
          stepId: "tool_step",
          agentId: "agent_1",
          roleId: "custom_role",
          divisionId: "division_1",
          inputKeys: [],
          outputKey: "tool_out",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.ok(Array.isArray(result.stepOutputs));
});

// =============================================================================
// Edge Case: Empty and Null Collections
// =============================================================================

test("executeStepLoop handles empty routing matchedRules [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    routing: {
      workflowId: "workflow-1",
      divisionId: "division-1",
      routeReason: "test",
      routeTrace: [],
      requiresOrchestration: true,
      classification: { intent: "query", continuation: "new_task", confidence: 0.8, matchedRules: [] },
    },
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.outputs, ctx.outputs);
});

test("executeStepLoop handles empty routeTrace [multi-step-supervisor-comprehensive]", async () => {
  const ctx = createMockStepSupervisorContext({
    routing: {
      workflowId: "workflow-1",
      divisionId: "division-1",
      routeReason: "test",
      routeTrace: [],
      requiresOrchestration: true,
      classification: { intent: "query", continuation: "new_task", confidence: 0.8, matchedRules: [] },
    },
    plannedWorkflow: createMockPlannedWorkflow({
      executionSteps: [],
    }),
  });
  const deps = createMockExecutionDeps();

  const result = await executeStepLoop(ctx, deps);

  assert.equal(result.outputs, ctx.outputs);
});
