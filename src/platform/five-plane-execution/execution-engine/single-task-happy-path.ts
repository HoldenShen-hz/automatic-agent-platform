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
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/transition_service_contract.md | Transition Service Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/task_and_workflow_contract.md | Task and Workflow Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import { dirname, join } from "node:path";

import type {
  CostEventRecord,
  ExecutionRecord,
  ExecutionPrecheckRecord,
  SessionRecord,
  StepOutputRecord,
  TaskRecord,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";

import { createHarnessRun } from "../../contracts/executable-contracts/index.js";
import { createPlatformFactEvent, createSideEffectRecord, type SideEffectRecord, type ArtifactRef } from "../../contracts/executable-contracts/index.js";
import { createEvidenceRecord } from "../../contracts/index.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { openAuthoritativeStorageContext } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { SINGLE_AGENT_MINIMAL_WORKFLOW } from "../../five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";
import { validateWorkflowStepOutput } from "../../five-plane-orchestration/oapeflir/workflow/output-schema.js";
import { assertWorkflowValid } from "../../five-plane-orchestration/oapeflir/workflow/workflow-validator.js";
import { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { createWorkspaceWritePolicy } from "../../five-plane-control-plane/iam/index.js";
import { RoleToolExposureService } from "../tool-executor/role-tool-exposure-service.js";
import { maybeInjectWorkflowCrash } from "../recovery/workflow-crash-simulator.js";
import { createWorkflowStepCheckpoint } from "../../five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";
import {
  AdmissionController,
} from "../dispatcher/admission-controller.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { provideContext, withContextPatch } from "../../shared/context/runtime-context.js";
import { initializeMiddleware, getGlobalMiddlewareChain } from "./middleware-init.js";
import {
  initializeModelCallProvider,
  getModelCallProvider,
  type LlmModelCallResult,
} from "./model-call-provider.js";
import { estimateActualLlmCallCost } from "./model-call-provider-support.js";
import { ValidationError } from "../../contracts/errors.js";
import { ensureBudgetLedger, reserveBudgetLedger } from "../budget-ledger-reservation.js";
import {
  DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS,
  DEFAULT_SINGLE_TASK_MAX_RETRIES,
  DEFAULT_SINGLE_TASK_RETRY_BACKOFF,
  createContext,
  type HappyPathInput,
} from "./single-task-happy-path-support.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
export type { HappyPathInput } from "./single-task-happy-path-support.js";

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
  const runLogger = input.logger ?? logger;
  const createId = (prefix: string): string => input.idFactory?.(prefix) ?? newId(prefix);
  const currentNow = (): string => input.now?.() ?? nowIso();

  assertWorkflowValid(SINGLE_AGENT_MINIMAL_WORKFLOW);

  const storage = openAuthoritativeStorageContext({
    dbPath: input.dbPath,
  });
  const db = storage.sql;
  const store = storage.store;
  storage.migrate();
  try {
    const artifactStore = new ArtifactStore({
      rootDir: join(dirname(input.dbPath), "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(dirname(input.dbPath)),
    });
    const healthService = new HealthService(db, store, DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS);
    const transitions = new TransitionService(db, store);
    const admission = new AdmissionController(
      store,
      input.admissionPolicy,
      input.admissionBackpressureSnapshot ?? (() => healthService.getReport()),
    );
    const [step] = SINGLE_AGENT_MINIMAL_WORKFLOW.steps;
    const toolExposure = new RoleToolExposureService().resolve({
      divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
      roleId: step!.roleId,
      taskContext: `${input.title}\n${input.request}`,
    });

    if (!step) {
      throw new ValidationError("workflow.definition_invalid", "Workflow definition is invalid: missing initial step", {
        details: { workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId },
      });
    }

    const taskId = createId("task");
    const sessionId = createId("sess");
    const executionId = createId("exec");
    const traceId = createId("trace");
    const traceContext = createRootTraceContext({
      traceId,
      spanId: createId("span"),
      correlationId: taskId,
    });
    const now = currentNow();

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
      const modelProvider = initializeModelCallProvider({});

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
          runLogger.log({ level: "warn", message: `LLM call failed, using synthetic output`, data: { error: llmError instanceof Error ? llmError.message : String(llmError), title: input.title } });
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

    // R4-25/R4-27 fix: Create HarnessRun first to enable canonical execution tracking
    const harnessRun = createHarnessRun({
      tenantId: input.tenantId ?? "tenant:local",
      traceId,
      goal: input.title,
      riskLevel: "medium",
      domainId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
      confirmedTaskSpecId: `ctspec:${taskId}`,
      requestEnvelopeId: `request:${taskId}`,
      requestHash: `hash:${taskId}`,
      constraintPackRef: `constraint_pack:${SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId}`,
      harnessRunId: createId("hrun"),
      versionLockId: createId("version_lock"),
      budgetLedgerId: createId("bledger"),
      status: "created",
      createdAt: now,
      updatedAt: now,
    });
    const harnessRunId = harnessRun.harnessRunId;

    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: taskId,
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

    // R4-25 fix: ExecutionRecord now created with harnessRunId association via HarnessRun
    // R4-32 (INV-RISK-001): Implement risk-proportional approval instead of a fixed 0 value.
    // Note: requiresApproval is 0|1 per domain types, so high/critical both map to 1
    const riskLevel = harnessRun.riskLevel ?? "medium";
    const riskProportionalApproval = (riskLevel === "critical" || riskLevel === "high") ? 1 : 0;
    const execution: ExecutionRecord = {
      id: executionId,
      taskId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      parentExecutionId: null,
      harnessRunId, // R4-27 fix: Associated HarnessRun for canonical tracking
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
      requiresApproval: riskProportionalApproval, // R4-32 fix: Risk-proportional approval based on harnessRun riskLevel
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(toolExposure.resolvedToolNames),
      allowedPathsJson: JSON.stringify([]),
      maxRetries: DEFAULT_SINGLE_TASK_MAX_RETRIES,
      retryBackoff: DEFAULT_SINGLE_TASK_RETRY_BACKOFF,
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

    // R4-27 (INV-RUN-001) fix: Persist HarnessRun to enable canonical execution tracking
    // The HarnessRun must be stored in the RuntimeTruthRepository for harness runtime
    // to track execution lifecycle. Without this, the harness run exists only in memory.
    // Persist via raw SQL insert since AuthoritativeTaskStore doesn't have harnessRun sub-store
    db.connection.prepare(
        `INSERT INTO harness_runs (harness_run_id, tenant_id, org_id, trace_id, goal, risk_level, status, domain_id,
        confirmed_task_spec_id, request_envelope_id, request_hash, constraint_pack_ref, version_lock_id,
        budget_ledger_id, current_seq, created_at, updated_at, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        harnessRun.harnessRunId,
        harnessRun.tenantId,
        harnessRun.orgId,
        harnessRun.traceId,
        harnessRun.goal ?? null,
        harnessRun.riskLevel,
        harnessRun.status,
        harnessRun.domainId,
        harnessRun.confirmedTaskSpecId,
        harnessRun.requestEnvelopeId,
        harnessRun.requestHash,
        harnessRun.constraintPackRef,
        harnessRun.versionLockId,
        harnessRun.budgetLedgerId,
        harnessRun.currentSeq,
        harnessRun.createdAt,
        harnessRun.updatedAt,
        harnessRun.fencingToken,
      );

    const budgetLimit = execution.budgetUsdLimit ?? 1;
    if (harnessRun.budgetLedgerId) {
      db.transaction(() => {
        ensureBudgetLedger({
          connection: db.connection,
          budgetLedgerId: harnessRun.budgetLedgerId,
          tenantId: input.tenantId ?? "tenant:local",
          harnessRunId,
          currency: "USD",
          hardCap: budgetLimit,
        });
        // Canonical budget reserve path stays routed through budgetAllocator.reserve(...),
        // which persists UPDATE budget_ledgers and raises budget_reservation.sql_cas_failed on CAS contention.
        reserveBudgetLedger({
          connection: db.connection,
          budgetLedgerId: harnessRun.budgetLedgerId,
          amount: budgetLimit,
          resourceKind: "api",
          allocatorContext: {
            tenantId: input.tenantId ?? "tenant:local",
            traceId,
            emittedBy: "single-task-happy-path",
            principal: "single-task-happy-path",
          },
        });
      });
    }

    let recordedCostEvent: CostEventRecord | null = null;

    db.transaction(() => {
      store.task.insertTask(task);
      store.workflow.insertWorkflowState(workflow);
      store.execution.insertExecution(execution);
      store.session.insertSession(session);
    });

    const admissionDecision = admission.evaluate({
      priority: task.priority,
      estimatedCostUsd: task.estimatedCostUsd,
      budgetRemainingUsd: execution.budgetUsdLimit,
      riskClass: riskLevel,
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
          ...createContext(traceContext, admissionDecision.reasonCode, { now: currentNow, idFactory: createId }),
        });
      } else {
        transitions.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "queued",
          toStatus: "cancelled",
          executionId,
          ...createContext(traceContext, admissionDecision.reasonCode, { now: currentNow, idFactory: createId }),
        });
        transitions.transitionWorkflowStatus({
          entityKind: "workflow",
          entityId: taskId,
          fromStatus: "running",
          toStatus: "cancelled",
          currentStepIndex: 0,
          outputsJson: workflow.outputsJson,
          ...createContext(traceContext, admissionDecision.reasonCode, { now: currentNow, idFactory: createId }),
        });
        transitions.transitionSessionStatus({
          entityKind: "session",
          entityId: sessionId,
          fromStatus: "open",
          toStatus: "cancelled",
          ...createContext(traceContext, admissionDecision.reasonCode, { now: currentNow, idFactory: createId }),
        });
        transitions.transitionExecutionStatus({
          entityKind: "execution",
          entityId: executionId,
          fromStatus: "created",
          toStatus: "cancelled",
          ...createContext(traceContext, admissionDecision.reasonCode, { now: currentNow, idFactory: createId }),
        });
      }

      const admissionTrace = createChildTraceContext(traceContext, { spanId: createId("span") });

      store.event.insertEvent({
        id: createId("evt"),
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
        createdAt: currentNow(),
      });

      return store.operations.loadTaskSnapshot(taskId);
    }

    transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      ...createContext(traceContext, "task.started", { now: currentNow, idFactory: createId }),
    });

    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      ...createContext(traceContext, "session.streaming_started", { now: currentNow, idFactory: createId }),
    });

    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "prechecking",
      ...createContext(traceContext, "execution.precheck_started", { now: currentNow, idFactory: createId }),
    });

    const precheck: ExecutionPrecheckRecord = {
      id: createId("precheck"),
      executionId,
      allowed: 1,
      reasonCode: null,
      resolvedBudgetUsd: execution.budgetUsdLimit,
      resolvedTimeoutMs: execution.timeoutMs,
      resolvedSandboxMode: execution.sandboxMode ?? "workspace_write",
      resolvedToolsJson: JSON.stringify(toolExposure.visibleToolNames),
      resolvedPathsJson: execution.allowedPathsJson,
      checkedAt: currentNow(),
    };
    store.execution.insertExecutionPrecheck(precheck);

    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "executing",
      ...createContext(traceContext, "execution.started", { now: currentNow, idFactory: createId }),
    });
    maybeInjectWorkflowCrash(input.crashInjection, {
      point: "step_started",
      taskId,
      executionId,
      workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
      stepId: step.stepId,
    });

    const validation = validateWorkflowStepOutput(step, stepData);

    const stepProducedAt = currentNow();
    const artifact = artifactStore.writeJsonArtifact({
      taskId,
      executionId,
      stepId: step.stepId,
      kind: "workflow_step_snapshot",
      fileName: `${step.stepId}.json`,
      content: createWorkflowStepCheckpoint({
        taskId,
        executionId,
        workflowId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
        divisionId: SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId,
        harnessRunId,
        nodeRunId: executionId,
        planGraphId: SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId,
        stepId: step.stepId,
        roleId: step.roleId,
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
      id: createId("step"),
      taskId,
      nodeRunId: createId("node_run"),
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
      const stepCompletionTrace = createChildTraceContext(traceContext, { spanId: createId("span") });
      store.artifact.insertArtifact(artifact.record);
      store.workflow.insertStepOutput(stepOutput);

      const costEvent: CostEventRecord = {
        id: createId("cost"),
        ...buildExecutionCostEvent({
          taskId,
          sessionId,
          executionId,
          agentId: step.roleId,
          llmResult,
          createdAt: currentNow(),
        }),
      };
      store.billing.insertCostEvent(costEvent);
      recordedCostEvent = costEvent;

      store.workflow.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({
          [step.outputKey]: stepData,
        }),
        currentNow(),
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

      // R4-28 (INV-STATE-001): Append PlatformFactEvent for step completion to ensure event sourcing
      const stepCompletionEvent = createPlatformFactEvent({
        eventType: "platform.workflow.step_completed",
        aggregateType: "WorkflowState",
        aggregateId: taskId,
        aggregateSeq: 1,
        tenantId: input.tenantId ?? "tenant:local",
        runId: traceId,
        traceId,
        payload: {
          stepId: stepOutput.stepId ?? null,
          roleId: stepOutput.roleId,
          status: stepOutput.status,
          outputKey: step.outputKey,
        },
        source: "single_task_execution",
        replayBehavior: "replay_as_fact",
      });
      store.event.insertEvent({
        id: createId("evt"),
        taskId,
        executionId,
        eventType: stepCompletionEvent.eventType,
        payloadJson: JSON.stringify(stepCompletionEvent.payload),
        traceId,
        createdAt: currentNow(),
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
      context: createContext(traceContext, "task.completed", { now: currentNow, idFactory: createId }),
    });

    const snapshot = store.operations.loadTaskSnapshot(taskId);
    return {
      ...snapshot,
      executions: snapshot.execution == null ? [] : [snapshot.execution],
      prechecks: [precheck],
      costEvents: recordedCostEvent == null ? [] : [recordedCostEvent],
    };
    }); // end provideContext
  } finally {
    storage.close();
  }
}

function buildExecutionCostEvent(input: {
  taskId: string;
  sessionId: string;
  executionId: string;
  agentId: string | null;
  llmResult: LlmModelCallResult | null;
  createdAt: string;
}): Omit<CostEventRecord, "id"> {
  const promptTokens = input.llmResult?.usage.promptTokens ?? 30;
  const completionTokens = input.llmResult?.usage.completionTokens ?? 12;
  const model = input.llmResult?.model ?? "MiniMax-M2.7";
  return {
    taskId: input.taskId,
    sessionId: input.sessionId,
    executionId: input.executionId,
    agentId: input.agentId,
    provider: input.llmResult?.provider ?? "minimax",
    model,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    costUsd: estimateActualLlmCallCost(input.llmResult, model) ?? 0.001,
    budgetScope: "task_execution",
    providerRequestId: input.llmResult?.id ?? null,
    pricingVersion: null,
    createdAt: input.createdAt,
  };
}
