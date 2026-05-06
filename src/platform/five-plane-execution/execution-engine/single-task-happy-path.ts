/**
 * @fileoverview Single-task execution happy path.
 *
 * This module implements the simplest possible workflow execution scenario where:
 * - A single task is created from user input
 * - A single step (intake_triage) is executed
 * - The workflow completes immediately after that one step
 *
 * This serves as the baseline "happy path" for testing and demonstrating the core
 * runtime infrastructure without the complexity of multi-step orchestration.
 *
 * The happy path validates the entire lifecycle:
 * Task creation → Workflow initialization → Execution → Step completion → Task terminal state
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/transition_service_contract.md | Transition Service Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/task_and_workflow_contract.md | Task and Workflow Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import { dirname, join } from "node:path";

import type {
  CostEventRecord,
  ExecutionRecord,
  ExecutionPrecheckRecord,
  SessionRecord,
  StepOutputRecord,
  TaskRecord,
  TransitionAuditContext,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";

import type { PlatformFactEvent } from "../../contracts/executable-contracts/index.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { openAuthoritativeStorageContext } from "../../state-evidence/truth/storage-backend-factory.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { SINGLE_AGENT_MINIMAL_WORKFLOW } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
import { validateWorkflowStepOutput } from "../../orchestration/oapeflir/workflow/output-schema.js";
import { assertWorkflowValid } from "../../orchestration/oapeflir/workflow/workflow-validator.js";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { createWorkspaceWritePolicy } from "../../control-plane/iam/sandbox-policy.js";
import { RoleToolExposureService } from "../tool-executor/role-tool-exposure-service.js";
import type { WorkflowCrashInjection } from "../recovery/workflow-crash-simulator.js";
import { maybeInjectWorkflowCrash } from "../recovery/workflow-crash-simulator.js";
import { createWorkflowStepCheckpoint } from "../../state-evidence/checkpoints/workflow-step-checkpoint.js";
import { PolicyEngine, mapToolRiskToPolicyCategory } from "../../five-plane-control-plane/iam/policy-engine.js";
import { ApprovalPolicyEngine, DEFAULT_APPROVAL_POLICY_BUNDLE, type ApprovalPolicyContext } from "../../five-plane-control-plane/approval-center/approval-policy-engine/index.js";
import type { BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
import {
  AdmissionController,
  type AdmissionBackpressureSnapshot,
  type AdmissionPolicy,
} from "../dispatcher/admission-controller.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { provideContext, withContextPatch } from "./runtime-context.js";
import { initializeMiddleware, getGlobalMiddlewareChain } from "./middleware-init.js";
import {
  initializeModelCallProvider,
  getModelCallProvider,
  type LlmModelCallResult,
} from "./model-call-provider.js";
import { ValidationError } from "../../contracts/errors.js";
import { RuntimeEntryGuard } from "../../orchestration/harness/runtime/runtime-entry-guard.js";
import { minimalWorkflowToPlanGraphBundle } from "../../five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { createBudgetLedger, createHarnessRun, createRunVersionLock } from "../../contracts/executable-contracts/index.js";
import { execute as executeQuery } from "../../state-evidence/truth/sqlite/query-helper.js";
import { BudgetExecutionSessionManager, BudgetExecutionState, BudgetGuard } from "../../model-gateway/cost-tracker/budget-guard.js";
import { BudgetTier } from "../budget-allocator.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;

/**
 * Input parameters for single-task execution.
 * These values are typically provided by the CLI or API caller.
 */
export interface HappyPathInput {
  /** Absolute path to the SQLite database file for persistence */
  dbPath: string;
  /** Human-readable title for the task */
  title: string;
  /** The user's original request or instruction */
  request: string;
  /** Optional tenant scope for the created task */
  tenantId?: string | null;
  /** Optional admission policy override for runtime backpressure validation */
  admissionPolicy?: AdmissionPolicy;
  /** Optional backpressure snapshot supplier used by the admission controller */
  admissionBackpressureSnapshot?: () => AdmissionBackpressureSnapshot | null;
  /** Optional crash injection used by recovery drills */
  crashInjection?: WorkflowCrashInjection;
  /** Optional override used by tests to force schema validation paths */
  stepOutputOverride?: Record<string, unknown>;
}

/**
 * Creates a standardized audit context for tracking state transitions.
 * Every transition in the system is recorded with this context for traceability.
 *
 * @param traceId - Unique identifier linking all events within a single request flow
 * @param reasonCode - Machine-readable code explaining why this transition occurred (e.g., "task.started")
 * @returns A complete TransitionAuditContext object with timestamp and actor information
 */
function createContext(
  traceContext: ReturnType<typeof createRootTraceContext>,
  reasonCode: string,
): TransitionAuditContext {
  const span = createChildTraceContext(traceContext);
  const context: TransitionAuditContext = {
    reasonCode,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId,
    actorType: "system",
    occurredAt: nowIso(),
  };
  if (span.spanId != null) {
    context.spanId = span.spanId;
  }
  if (span.correlationId != null) {
    context.correlationId = span.correlationId;
  }
  return context;
}

/**
 * Executes the single-task workflow.
 *
 * This function orchestrates the complete lifecycle of a simple single-step task:
 * 1. Validates the minimal workflow definition
 * 2. Initializes the authoritative storage backend and repository layers
 * 3. Creates task, workflow, execution, and session records
 * 4. Transitions through all required states (queued → in_progress → executing → done)
 * 5. Produces a synthetic step output representing the "intake_triage" step
 * 6. Writes the step output artifact and completes the task
 *
 * @param input - Configuration for the happy path execution
 * @returns A complete task snapshot containing all records and final state
 */
export async function runSingleTaskExecution(input: HappyPathInput) {
  initializeMiddleware();
  const middlewareChain = getGlobalMiddlewareChain();

  // R4-26/R4-27 (INV-GRAPH-001/INV-RUN-001): RuntimeEntryGuard is mandatory at dispatch entry
  // All execution paths must pass through PlanGraphBundle validation before writing truth
  const entryGuard = new RuntimeEntryGuard();
  // Verify that any event writes follow the platform.* fact event requirement
  entryGuard.assertNoLegacyTruthWrite({ eventType: "platform.graph_scheduler.decision_recorded" });

  assertWorkflowValid(SINGLE_AGENT_MINIMAL_WORKFLOW);

  // R4-26 (INV-GRAPH-001): Create PlanGraphBundle as only P3→P4 contract
  const harnessRunId = newId("harness_run");
  const planGraphBundle = minimalWorkflowToPlanGraphBundle(SINGLE_AGENT_MINIMAL_WORKFLOW, harnessRunId);

  // R4-27 (INV-RUN-001): Enforce HarnessRuntime is only execution entry via RuntimeEntryGuard
  const guardResult = entryGuard.assertPlanGraphBundleOnly(planGraphBundle);
  const validatedPlanGraphBundle = guardResult.planGraphBundle;
  // R4-26 (INV-GRAPH-001): Use validatedPlanGraphBundle - harnessRunId is available for budget tracking
  const harnessRunIdFromBundle = validatedPlanGraphBundle.harnessRunId;
  // R4-25 (INV-BUDGET-001): Create budgetLedger from validated PlanGraphBundle for reserve-before-execute
  // The budgetLedger flows to model-call-provider for BudgetAllocator.reserve() before LLM calls
  const budgetLedger = createBudgetLedger({
    tenantId: input.tenantId ?? "tenant:local",
    harnessRunId: harnessRunIdFromBundle,
    currency: "USD",
    hardCap: 10, // matches default maxTaskCostUsd
  });

  const storage = openAuthoritativeStorageContext({
    dbPath: input.dbPath,
  });
  const db = storage.sql;
  const store = storage.store;
  storage.migrate();

  // R4-26 (INV-GRAPH-001): Derive taskId FROM PlanGraphBundle - use planGraphBundleId as authoritative identifier
  // Previously created independently with newId("task"), which violated P3→P4 contract invariant
  const taskId = validatedPlanGraphBundle.planGraphBundleId;

    // R4-27 (INV-RUN-001): Create and persist HarnessRun entity as the actual execution entry point
    // This establishes the runtime truth that HarnessRuntime is the authoritative execution root
    const harnessRun = createHarnessRun({
      tenantId: input.tenantId ?? "tenant:local",
      traceId: `trace:${harnessRunIdFromBundle}`,
      riskLevel: "medium",
      ownership: { ownerId: input.tenantId ?? "tenant:local", ownerType: "tenant" },
      confirmedTaskSpecId: `pending:${taskId}`,
      requestEnvelopeId: `pending:${taskId}`,
      requestHash: `request:${taskId}`,
      constraintPackRef: validatedPlanGraphBundle.budgetPlanRef ?? `workflow:${SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId}`,
      versionLockId: `pending:${harnessRunIdFromBundle}`,
      budgetLedgerId: budgetLedger.budgetLedgerId,
      harnessRunId: harnessRunIdFromBundle,
      status: "created",
    });
    const runVersionLock = createRunVersionLock({
      harnessRunId: harnessRunIdFromBundle,
      runtimeProfileVersion: "runtime-profile:default",
    });

  try {
    const artifactStore = new ArtifactStore({
      rootDir: join(dirname(input.dbPath), "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(dirname(input.dbPath)),
    });
    const healthService = new HealthService(db, store, DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS);
    const transitions = new TransitionService(db, store);
    // R8-01 FIX: Initialize BudgetExecutionSessionManager for atomic reserve→execute→settle
    // This must be created before admission evaluation to support budget reservation verification
    const budgetSessionManager = new BudgetExecutionSessionManager();
    const admission = new AdmissionController(
      store,
      input.admissionPolicy,
      input.admissionBackpressureSnapshot ?? (() => healthService.getReport()),
      budgetSessionManager,
    );
    // R4-32 (INV-APPROVAL): Initialize approval policy engine for risk-proportional approval
    const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
    const [step] = SINGLE_AGENT_MINIMAL_WORKFLOW.steps;

    if (!step) {
      throw new ValidationError("workflow.definition_invalid", "Workflow definition is invalid: missing initial step", {
        details: { workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId },
      });
    }

    // R4-26 (INV-GRAPH-001): Use executionRoleId which is set by minimalWorkflowToPlanGraphBundle
    // to preserve the original roleId after PlanNode conversion. This ensures the execution
    // path uses the role from the PlanGraphBundle rather than relying on the original
    // workflow definition directly.
    const stepRoleId = step.executionRoleId ?? step.roleId;
    const toolExposure = new RoleToolExposureService().resolve({
      divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
      roleId: stepRoleId,
      taskContext: `${input.title}\n${input.request}`,
    });

    const sessionId = newId("sess");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const traceContext = createRootTraceContext({
      traceId,
      correlationId: taskId,
    });
    const now = nowIso();

    // Try to get model call provider and make real LLM call (must happen before provideContext)
    let llmResult: LlmModelCallResult | null = null;
    let stepData: Record<string, unknown>;

    if (input.stepOutputOverride) {
      // Use override for testing
      stepData = {
        summary: `Analyzed request for ${input.title}`,
        result: `Single-agent happy path finished for: ${input.request}`,
        ...input.stepOutputOverride,
      };
    } else {
      // Initialize model call provider if not already done
      // R4-25 (INV-BUDGET-001): Pass budgetLedger and harnessRunId from validatedPlanGraphBundle
      // so BudgetAllocator.reserve() is called before createCompletion()
      const modelProvider = initializeModelCallProvider({
        budgetLedger,
        harnessRunId: harnessRunIdFromBundle,
      });

      if (modelProvider.hasAnyProvider()) {
        try {
          const messages = [
            { role: "system" as const, content: "You are a helpful assistant that analyzes requests and produces structured outputs." },
            { role: "user" as const, content: input.request },
          ];

          llmResult = await modelProvider.createCompletion({
            model: modelProvider.getDefaultModel(),
            messages,
            maxTokens: 1024,
          });

          stepData = {
            summary: `Analyzed request for ${input.title}`,
            result: llmResult.content || `Analyzed: ${input.request}`,
            modelUsed: llmResult.model,
            provider: llmResult.provider,
            usage: llmResult.usage,
          };
        } catch (llmError) {
          // Fall back to synthetic output if LLM call fails
          logger.log({ level: "warn", message: `LLM call failed, using synthetic output`, data: { error: llmError instanceof Error ? llmError.message : String(llmError), title: input.title } });
          stepData = {
            summary: `Analyzed request for ${input.title}`,
            result: `Single-agent happy path finished for: ${input.request}`,
            llmError: llmError instanceof Error ? llmError.message : String(llmError),
          };
        }
      } else {
        // No LLM provider configured, use synthetic output
        stepData = {
          summary: `Analyzed request for ${input.title}`,
          result: `Single-agent happy path finished for: ${input.request}`,
        };
      }
    }

    return provideContext({
      traceId,
      spanId: traceContext.spanId,
      taskId,
      executionId,
      sessionId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
      agentId: step.roleId,
    }, () => {

    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: taskId,
      // R4-27 (INV-RUN-001): Derive task from HarnessRun - task must reference its authorizing HarnessRun
      harnessRunId: harnessRunIdFromBundle,
      divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
      tenantId: input.tenantId ?? null,
      title: input.title,
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: input.request }),
      normalizedInputJson: JSON.stringify({ request: input.request.trim() }),
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    const workflow: WorkflowStateRecord = {
      taskId,
      divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      currentStepIndex: 0,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    };

    // R4-32 (INV-APPROVAL): Evaluate risk-proportional approval before creating execution
    const approvalContext: ApprovalPolicyContext = {
      decisionId: newId("approval"),
      taskId,
      executionId,
      sessionId,
      subjectType: "agent",
      subjectId: "agent_general_executor",
      action: "invoke_tool",
      riskCategory: (() => {
          // R4-32 (INV-APPROVAL): Derive actual risk category from tool metadata
          const toolName = (step as unknown as { toolName?: string }).toolName ?? step.stepId ?? "todo_write";
          const riskLevels: Record<string, "low" | "medium" | "high" | "critical"> = {
            web_fetch: "medium", web_search: "medium", git: "high", spawn_agent: "high",
            batch_tool: "medium", todo_write: "low", repo_map: "low", question: "low",
          };
          const riskLevel = riskLevels[toolName] ?? "medium";
          return mapToolRiskToPolicyCategory(riskLevel);
        })(),
      mode: "auto",
      stage: "execute",
      estimatedCostUsd: 1,
      metadata: { roleId: step.roleId, stepId: step.stepId },
    };
    const approvalResult = approvalEngine.evaluate(approvalContext);

    const execution: ExecutionRecord = {
      id: executionId,
      taskId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      parentExecutionId: null,
      agentId: "agent_general_executor",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId,
      attempt: 1,
      timeoutMs: step.timeoutMs,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
      // R4-32 (INV-APPROVAL): Use risk-proportional approval from PolicyEngine
      // approvalResult.requiresApproval is boolean - convert to 0/1 for DB
      requiresApproval: approvalResult.requiresApproval ? 1 : 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(toolExposure.resolvedToolNames),
      allowedPathsJson: JSON.stringify([]),
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const session: SessionRecord = {
      id: sessionId,
      taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    // R4-28 (INV-STATE-001): Every truth mutation must append a PlatformFactEvent in the same transaction
    const taskCreatedEvent = {
      id: newId("evt"),
      taskId,
      executionId: null as string | null,
      eventType: "platform.task.status_changed",
      eventTier: "tier_1" as const,
      payloadJson: JSON.stringify({
        aggregateType: "Task",
        fromStatus: null,
        toStatus: "queued",
        reasonCode: "task.created",
        emittedBy: "single_task_happy_path",
      }),
      traceId,
      createdAt: now,
    };

    const workflowCreatedEvent = {
      id: newId("evt"),
      taskId,
      executionId: null as string | null,
      eventType: "platform.workflow.status_changed",
      eventTier: "tier_1" as const,
      payloadJson: JSON.stringify({
        aggregateType: "Workflow",
        fromStatus: null,
        toStatus: "running",
        reasonCode: "workflow.started",
        emittedBy: "single_task_happy_path",
      }),
      traceId,
      createdAt: now,
    };

    const executionCreatedEvent = {
      id: newId("evt"),
      taskId,
      executionId,
      eventType: "platform.execution.status_changed",
      eventTier: "tier_1" as const,
      payloadJson: JSON.stringify({
        aggregateType: "Execution",
        fromStatus: null,
        toStatus: "created",
        reasonCode: "execution.created",
        emittedBy: "single_task_happy_path",
      }),
      traceId,
      createdAt: now,
    };

    const sessionCreatedEvent = {
      id: newId("evt"),
      taskId,
      executionId: null as string | null,
      eventType: "platform.session.status_changed",
      eventTier: "tier_1" as const,
      payloadJson: JSON.stringify({
        aggregateType: "Session",
        fromStatus: null,
        toStatus: "open",
        reasonCode: "session.created",
        emittedBy: "single_task_happy_path",
      }),
      traceId,
      createdAt: now,
    };

    // R4-27/R4-28 (INV-STATE-001): Emit harness_run.status_changed event to pair with HarnessRun INSERT
    const harnessRunCreatedEvent = {
      id: newId("evt"),
      taskId,
      executionId: null as string | null,
      eventType: "platform.harness_run.status_changed",
      eventTier: "tier_1" as const,
      payloadJson: JSON.stringify({
        harnessRunId: harnessRunIdFromBundle,
        status: "created",
        tenantId: input.tenantId ?? "tenant:local",
        domainId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
        occurredAt: now,
      }),
      traceId,
      createdAt: now,
    };

    db.transaction(() => {
      // R4-27 (INV-RUN-001): Insert harness_run record inside transaction for atomicity
      executeQuery(
        db.connection,
        `INSERT INTO harness_runs (
          harness_run_id, tenant_id, confirmed_task_spec_id, request_envelope_id,
          status, version_lock_id, budget_ledger_id, current_seq, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        harnessRun.harnessRunId,
        harnessRun.tenantId,
        harnessRun.confirmedTaskSpecId,
        harnessRun.requestEnvelopeId,
        harnessRun.status,
        runVersionLock.runVersionLockId,
        harnessRun.budgetLedgerId,
        harnessRun.currentSeq,
        harnessRun.updatedAt,
      );
      // Insert plan_graph_bundle record inside transaction for atomicity
      executeQuery(
        db.connection,
        `INSERT INTO plan_graph_bundles (
          plan_graph_bundle_id, harness_run_id, graph_version, graph_json, validation_report_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        validatedPlanGraphBundle.planGraphBundleId,
        harnessRunIdFromBundle,
        validatedPlanGraphBundle.graphVersion,
        JSON.stringify(validatedPlanGraphBundle.graph),
        JSON.stringify(validatedPlanGraphBundle.validationReport),
        validatedPlanGraphBundle.createdAt,
      );
      store.task.insertTask(task);
      store.workflow.insertWorkflowState(workflow);
      store.execution.insertExecution(execution);
      store.session.insertSession(session);
      // R4-28 (INV-STATE-001): Append PlatformFactEvents in same transaction as truth mutations
      store.event.insertEvent(taskCreatedEvent);
      store.event.insertEvent(workflowCreatedEvent);
      store.event.insertEvent(executionCreatedEvent);
      store.event.insertEvent(sessionCreatedEvent);
      store.event.insertEvent(harnessRunCreatedEvent);
    });

    // Root cause: the original approval gate tried to transition task/workflow/
    // session/execution before their baseline truth rows existed. Persist the
    // created records first, then block on approval if required.
    if (approvalResult.requiresApproval) {
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "awaiting_decision",
        executionId,
        ...createContext(traceContext, "approval.required"),
      });
      transitions.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: taskId,
        fromStatus: "running",
        toStatus: "paused",
        currentStepIndex: 0,
        outputsJson: workflow.outputsJson,
        ...createContext(traceContext, "approval.required"),
      });
      transitions.transitionSessionStatus({
        entityKind: "session",
        entityId: sessionId,
        fromStatus: "open",
        toStatus: "awaiting_user",
        ...createContext(traceContext, "approval.required"),
      });
      transitions.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "created",
        toStatus: "blocked",
        ...createContext(traceContext, "approval.required"),
      });

      const approvalTrace = createChildTraceContext(traceContext);
      store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "decision:requested",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          approvalId: newId("approval"),
          decisionId: approvalContext.decisionId,
          taskId,
          executionId,
          subjectType: approvalContext.subjectType,
          subjectId: approvalContext.subjectId,
          action: approvalContext.action,
          riskCategory: approvalContext.riskCategory,
          reasonCode: approvalResult.reasonCode ?? "approval.risk_proportional_required",
          stage: approvalContext.stage,
          estimatedCostUsd: approvalContext.estimatedCostUsd,
          traceContext: approvalTrace,
        }),
        traceId,
        createdAt: nowIso(),
      });

      return store.operations.loadTaskSnapshot(taskId);
    }

    // R8-01 FIX: Create budget reservation BEFORE admission evaluation
    // This implements the reserve-before-execute pattern required by admission controller
    const defaultBudgetPolicy: BudgetPolicy = {
      maxTaskCostUsd: 10,
      maxPackCostUsd: 100,
      maxPlatformCostUsd: 10000,
      maxDailyCostUsd: 100,
      maxMonthlyCostUsd: 1000,
      maxModelTokens: 100000,
      maxSteps: 100,
      maxDurationMs: 600000,
      warnAtRatio: 0.8,
      mode: "auto",
    };
    let budgetReservationId: string | null = null;
    try {
      const budgetSession = budgetSessionManager.reserveAndCreateSession(
        {
          tenantId: input.tenantId ?? "tenant:local",
          harnessRunId: harnessRunIdFromBundle,
          traceId,
          emittedBy: "single_task_happy_path",
          ledger: budgetLedger,
          policy: defaultBudgetPolicy,
        },
        task.estimatedCostUsd ?? 0,
        "token",
      );
      budgetReservationId = budgetSession.sessionId;
      // Mark as executing immediately since we're in the happy path
      budgetSessionManager.markExecuting(budgetReservationId);
    } catch (error) {
      // Budget reservation failed - reject the task
      logger.log({ level: "warn", message: `Budget reservation failed, cancelling task`, data: { error: error instanceof Error ? error.message : String(error), taskId } });
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "cancelled",
        executionId,
        ...createContext(traceContext, "budget.reservation_failed"),
      });
      transitions.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: taskId,
        fromStatus: "running",
        toStatus: "cancelled",
        currentStepIndex: 0,
        outputsJson: workflow.outputsJson,
        ...createContext(traceContext, "budget.reservation_failed"),
      });
      transitions.transitionSessionStatus({
        entityKind: "session",
        entityId: sessionId,
        fromStatus: "open",
        toStatus: "cancelled",
        ...createContext(traceContext, "budget.reservation_failed"),
      });
      transitions.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "created",
        toStatus: "cancelled",
        ...createContext(traceContext, "budget.reservation_failed"),
      });
      return store.operations.loadTaskSnapshot(taskId);
    }

    const admissionDecision = admission.evaluate({
      priority: task.priority,
      estimatedCostUsd: task.estimatedCostUsd,
      budgetRemainingUsd: execution.budgetUsdLimit,
      budgetReservationId,
    });
    if (admissionDecision.decision !== "allow") {
      if (admissionDecision.decision === "queue") {
        transitions.transitionWorkflowStatus({
          entityKind: "workflow",
          entityId: taskId,
          fromStatus: "running",
          toStatus: "paused",
          currentStepIndex: 0,
          outputsJson: workflow.outputsJson,
          ...createContext(traceContext, admissionDecision.reasonCode),
        });
      } else {
        transitions.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "queued",
          toStatus: "cancelled",
          executionId,
          ...createContext(traceContext, admissionDecision.reasonCode),
        });
        transitions.transitionWorkflowStatus({
          entityKind: "workflow",
          entityId: taskId,
          fromStatus: "running",
          toStatus: "cancelled",
          currentStepIndex: 0,
          outputsJson: workflow.outputsJson,
          ...createContext(traceContext, admissionDecision.reasonCode),
        });
        transitions.transitionSessionStatus({
          entityKind: "session",
          entityId: sessionId,
          fromStatus: "open",
          toStatus: "cancelled",
          ...createContext(traceContext, admissionDecision.reasonCode),
        });
        transitions.transitionExecutionStatus({
          entityKind: "execution",
          entityId: executionId,
          fromStatus: "created",
          toStatus: "cancelled",
          ...createContext(traceContext, admissionDecision.reasonCode),
        });
      }

      const admissionTrace = createChildTraceContext(traceContext);

      store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: admissionDecision.decision === "queue" ? "admission:queued" : "admission:rejected",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          decision: admissionDecision.decision,
          reasonCode: admissionDecision.reasonCode,
          snapshot: admissionDecision.snapshot,
          backpressure: admissionDecision.backpressure,
          traceContext: admissionTrace,
        }),
        traceId,
        createdAt: nowIso(),
      });

      return store.operations.loadTaskSnapshot(taskId);
    }

    transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      ...createContext(traceContext, "task.started"),
    });

    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      ...createContext(traceContext, "session.streaming_started"),
    });

    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      ...createContext(traceContext, "execution.precheck_started"),
    });

    const precheck: ExecutionPrecheckRecord = {
      id: newId("precheck"),
      executionId,
      allowed: 1,
      reasonCode: null,
      resolvedBudgetUsd: execution.budgetUsdLimit,
      resolvedTimeoutMs: execution.timeoutMs,
      resolvedSandboxMode: execution.sandboxMode ?? "workspace_write",
      resolvedToolsJson: JSON.stringify(toolExposure.visibleToolNames),
      resolvedPathsJson: execution.allowedPathsJson,
      checkedAt: nowIso(),
    };
    store.execution.insertExecutionPrecheck(precheck);

    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "executing",
      ...createContext(traceContext, "execution.started"),
    });
    maybeInjectWorkflowCrash(input.crashInjection, {
      point: "step_started",
      taskId,
      executionId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      stepId: step.stepId,
    });

    const validation = validateWorkflowStepOutput(step, stepData);

    const stepProducedAt = nowIso();
    const artifact = artifactStore.writeJsonArtifact({
      taskId,
      executionId,
      stepId: step.stepId,
      kind: "workflow_step_snapshot",
      fileName: `${step.stepId}.json`,
      content: createWorkflowStepCheckpoint({
        harnessRunId: harnessRunIdFromBundle,
        nodeRunId: step.stepId,
        planGraphBundleId: validatedPlanGraphBundle.planGraphBundleId,
        taskId,
        executionId,
        workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
        divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
        stepId: step.stepId,
        roleId: stepRoleId,
        outputKey: step.outputKey,
        status: "succeeded",
        producedAt: stepProducedAt,
        output: stepData,
        decisionContext: {
          source: "single_task_execution",
          request: input.request,
          routeReason: null,
          priorStepSummaries: [],
          dependsOnStepIds: [],
        },
        resumeContext: {
          completedStepIds: [step.stepId],
          nextStepId: null,
          outputKeys: [step.outputKey],
        },
        compensationModel: step.compensationModel ?? null,
      }),
      lineage: {
        traceId,
        workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
        divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
        source: "single_task_execution",
      },
    });

    const stepOutput: StepOutputRecord = {
      id: newId("step"),
      taskId,
      stepId: step.stepId,
      roleId: step.roleId,
      status: "succeeded",
      dataJson: JSON.stringify(stepData),
      summary: stepData.summary as string,
      artifactsJson: JSON.stringify([artifact.ref]),
      tokenCost: 42,
      durationMs: 1200,
      validationJson: JSON.stringify(validation),
      producedAt: stepProducedAt,
    };

    maybeInjectWorkflowCrash(input.crashInjection, {
      point: "before_commit",
      taskId,
      executionId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      stepId: step.stepId,
    });

    db.transaction(() => {
      const stepCompletionTrace = createChildTraceContext(traceContext);
      store.artifact.insertArtifact(artifact.record);
      store.workflow.insertStepOutput(stepOutput);

      const costEvent: CostEventRecord = {
        id: newId("cost"),
        taskId,
        sessionId,
        executionId,
        agentId: step.roleId,
        provider: "minimax",
        model: "MiniMax-M2.7",
        inputTokens: 30,
        outputTokens: 12,
        costUsd: 0.001,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: nowIso(),
      };
      store.billing.insertCostEvent(costEvent);

      store.workflow.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({
          [step.outputKey]: stepData,
        }),
        nowIso(),
      );
      store.event.createTier1StatusEvent({
        taskId,
        executionId,
        eventType: "workflow:step_completed",
        traceId,
        payload: injectTraceContext({
          stepId: stepOutput.stepId,
          roleId: stepOutput.roleId,
          status: stepOutput.status,
        }, stepCompletionTrace),
      });
    });
    maybeInjectWorkflowCrash(input.crashInjection, {
      point: "tool_completed",
      taskId,
      executionId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      stepId: step.stepId,
    });

    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify(stepData),
      outputsJson: JSON.stringify({
        [step.outputKey]: stepData,
      }),
      context: createContext(traceContext, "task.completed"),
    });

    return store.operations.loadTaskSnapshot(taskId);
    }); // end provideContext
  } finally {
    storage.close();
  }
}

export const runPhase1AHappyPath = runSingleTaskExecution;
