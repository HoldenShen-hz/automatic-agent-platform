/**
 * Human Takeover Service
 *
 * Enables human operators to intervene in task execution by opening takeover sessions,
 * modifying inputs, switching workers, retrying executions, skipping steps, and
 * completing tasks with manual terminal states.
 *
 * All actions are recorded as audit events for accountability and traceability.
 * This service is the primary interface for the admin console to interact with
 * running tasks and workflows during incident response or manual intervention.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/admin_console_and_human_takeover_contract.md | Human Takeover Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */

import type { ExecutionRecord, OperatorActionType, StepOutputRecord, TaskSnapshot, TakeoverSessionRecord } from "../../contracts/types/domain.js";

import { getWorkflowDefinition } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";
import { createRecoverySession, isSessionTerminalStatus } from "../../contracts/types/status.js";
import { ValidationError } from "../../contracts/errors.js";
import {
  executionTerminalForTask,
  normalizeInputJson,
  normalizeJson,
  parseOutputs,
  resolveManualStepOutputSummary,
  resolveWorkflowStepTarget,
  serializeSnapshot,
  sessionTerminalForTask,
  throwTakeoverStorageError,
  throwTakeoverWorkflowError,
  workflowTerminalForTask,
} from "./human-takeover-support.js";
import type { ControlPlaneDirectiveSink } from "../control-plane-directive-sink.js";
import { createOperationalDirective } from "../../contracts/control-directive/index.js";

/**
 * Result of a takeover action operation.
 * Contains identifiers needed to track the action and its effects.
 */
export interface TakeoverActionResult {
  taskId: string;
  executionId: string | null;
  takeoverSessionId: string;
  operatorActionId: string;
}

/**
 * HumanTakeoverService manages operator interventions in task execution.
 * Operators can take over tasks, modify their state, and guide them to completion.
 * All actions are recorded as audit events for accountability.
 *
 * The service maintains a session-based model where operators open a session
 * before performing multiple actions on a task. Each action is atomic and
 * recorded with before/after state snapshots for audit purposes.
 */
export class HumanTakeoverService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    private readonly directiveSink?: ControlPlaneDirectiveSink | null,
  ) {}

  /**
   * Opens a new takeover session for a task, enabling an operator to intervene.
   * Creates a session record, initial operator action, and tier-2 event for tracking.
   *
   * @param input - Contains taskId, operatorId making the takeover, and reasonCode
   * @returns TakeoverActionResult with session and action identifiers
   */
  public openSession(input: {
    taskId: string;
    operatorId: string;
    reasonCode: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    const snapshot = this.store.operations.loadTaskSnapshot(input.taskId, input.tenantId);
    const now = nowIso();
    const takeoverSessionId = newId("takeover");
    const operatorActionId = newId("opact");

    this.db.transaction(() => {
      this.store.approval.insertTakeoverSession({
        id: takeoverSessionId,
        taskId: input.taskId,
        executionId: snapshot.execution?.id ?? null,
        operatorId: input.operatorId,
        status: "open",
        reasonCode: input.reasonCode,
        startedAt: now,
        closedAt: null,
      });
      this.store.approval.insertOperatorAction({
        id: operatorActionId,
        takeoverSessionId,
        taskId: input.taskId,
        executionId: snapshot.execution?.id ?? null,
        operatorId: input.operatorId,
        actionType: "take_over_task",
        reasonCode: input.reasonCode,
        actionPayloadJson: JSON.stringify({}),
        beforeStateJson: JSON.stringify(serializeSnapshot(snapshot)),
        afterStateJson: JSON.stringify(serializeSnapshot(snapshot)),
        createdAt: now,
      });
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: input.taskId,
        executionId: snapshot.execution?.id ?? null,
        eventType: "takeover:session_opened",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          takeoverSessionId,
          operatorId: input.operatorId,
          reasonCode: input.reasonCode,
        }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    // R14-4: Emit pause OperationalDirective when human takeover session is opened
    this.emitPauseDirective(input.taskId, snapshot.execution?.id ?? null, input.operatorId, input.reasonCode);

    return {
      taskId: input.taskId,
      executionId: snapshot.execution?.id ?? null,
      takeoverSessionId,
      operatorActionId,
    };
  }

  /**
   * Modifies the input JSON for a task within an active takeover session.
   * The input is normalized to ensure valid JSON before storage.
   */
  public modifyInput(input: {
    takeoverSessionId: string;
    inputJson: string;
    normalizedInputJson?: string;
    reasonCode: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "modify_input", input.reasonCode, (snapshot, session, now) => {
      this.store.task.updateTaskInput(
        snapshot.task.id,
        input.inputJson,
        input.normalizedInputJson ?? normalizeInputJson(input.inputJson),
        now,
      );

      return {
        payload: {
          inputJson: input.inputJson,
        },
        executionId: snapshot.execution?.id ?? null,
      };
    }, input.tenantId);
  }

  /**
   * Switches the worker agent assigned to the current execution.
   * Updates the execution record with the new agent ID while preserving execution history.
   */
  public switchWorker(input: {
    takeoverSessionId: string;
    agentId: string;
    reasonCode: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "switch_worker", input.reasonCode, (snapshot, _session, now) => {
      if (!snapshot.execution) {
        throwTakeoverStorageError("takeover.execution_missing", { taskId: snapshot.task.id });
      }

      this.store.execution.updateExecutionAgent(snapshot.execution.id, input.agentId, now);

      return {
        payload: {
          previousAgentId: snapshot.execution.agentId,
          nextAgentId: input.agentId,
        },
        executionId: snapshot.execution.id,
      };
    }, input.tenantId);
  }

  /**
   * Retries the current execution by creating a new execution record.
   * Supersedes the previous execution and increments the attempt counter.
   * The task is reset to pending state to allow re-processing.
   *
   * This allows operators to re-run a failed or stuck workflow from the
   * beginning or from a specific step, depending on the workflow's resume state.
   */
  public retryExecution(input: {
    takeoverSessionId: string;
    reasonCode: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "retry_execution", input.reasonCode, (snapshot, _session, now) => {
      if (!snapshot.workflow || !snapshot.execution) {
        throwTakeoverWorkflowError("takeover.retry_requires_workflow_and_execution", {
          taskId: snapshot.task.id,
          hasWorkflow: snapshot.workflow != null,
          hasExecution: snapshot.execution != null,
        });
      }

      const workflow = snapshot.workflow;
      const previousExecution = snapshot.execution;
      const definition = getWorkflowDefinition(workflow.workflowId);
      const step = definition?.steps[Math.min(workflow.currentStepIndex, Math.max((definition?.steps.length ?? 1) - 1, 0))];
      const nextExecutionId = newId("exec");

      // Mark previous execution as superseded to maintain lineage
      this.store.execution.updateExecutionStatus(
        previousExecution.id,
        "superseded",
        now,
        null,
        now,
        "takeover.retry_execution",
      );

      // Create new execution record as a retry, incrementing attempt counter
      this.store.execution.insertExecution({
        ...previousExecution,
        id: nextExecutionId,
        parentExecutionId: previousExecution.id,
        status: "created",
        traceId: newId("trace"),
        attempt: previousExecution.attempt + 1,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
      } satisfies ExecutionRecord);

      // Reset task to pending for retry
      this.store.task.setTaskState({
        taskId: snapshot.task.id,
        status: "pending",
        updatedAt: now,
        errorCode: null,
        completedAt: null,
      });

      // Update workflow recovery state with incremented retry count
      this.store.workflow.updateWorkflowRecoveryState({
        taskId: snapshot.task.id,
        status: "running",
        currentStepIndex: workflow.currentStepIndex,
        outputsJson: workflow.outputsJson,
        updatedAt: now,
        resumableFromStep: workflow.resumableFromStep ?? step?.stepId ?? null,
        retryCount: workflow.retryCount + 1,
        lastErrorCode: null,
      });

      // Handle session state if present - reopen if not already open
      if (snapshot.session) {
        if (isSessionTerminalStatus(snapshot.session.status)) {
          // Create recovery session for terminal sessions
          this.store.session.insertSession(createRecoverySession(snapshot.session, now));
        } else if (snapshot.session.status !== "open") {
          this.store.session.updateSessionStatus(snapshot.session.id, "open", now);
        }
      }

      return {
        payload: {
          previousExecutionId: previousExecution.id,
          nextExecutionId,
          resumableFromStep: workflow.resumableFromStep ?? step?.stepId ?? null,
        },
        executionId: nextExecutionId,
      };
    }, input.tenantId);
  }

  /**
   * Moves the workflow to a different step, either by step ID or step index.
   * The workflow will resume from the specified step on next processing.
   * Useful for operators to skip problematic steps or redo steps out of order.
   */
  public setCurrentStep(input: {
    takeoverSessionId: string;
    reasonCode: string;
    stepId?: string;
    stepIndex?: number;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "set_current_step", input.reasonCode, (snapshot, _session, now) => {
      const workflow = snapshot.workflow;
      if (!workflow) {
        throwTakeoverWorkflowError("takeover.workflow_missing", { taskId: snapshot.task.id });
      }

      // Resolve the target step from either stepId (preferred) or stepIndex
      const target = resolveWorkflowStepTarget(workflow.workflowId, workflow.currentStepIndex, {
        ...(input.stepId !== undefined ? { stepId: input.stepId } : {}),
        ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
      });

      // Update workflow to resume from the new step
      this.store.workflow.updateWorkflowRecoveryState({
        taskId: snapshot.task.id,
        status: workflow.status,
        currentStepIndex: target.stepIndex,
        outputsJson: workflow.outputsJson,
        updatedAt: now,
        resumableFromStep: target.step.stepId ?? null,
        retryCount: workflow.retryCount,
        lastErrorCode: workflow.lastErrorCode,
      });

      return {
        payload: {
          previousStepIndex: workflow.currentStepIndex,
          previousResumableFromStep: workflow.resumableFromStep,
          nextStepIndex: target.stepIndex,
          nextStepId: target.step.stepId,
        },
        executionId: snapshot.execution?.id ?? null,
      };
    }, input.tenantId);
  }

  /**
   * Writes a manual step output for the current or specified step.
   * Allows operators to provide outputs directly, bypassing normal execution.
   * This is used when the operator wants to manually complete a step's work.
   */
  public writeStepOutput(input: {
    takeoverSessionId: string;
    outputJson: string;
    reasonCode: string;
    stepId?: string;
    stepIndex?: number;
    status?: StepOutputRecord["status"];
    summary?: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "write_step_output", input.reasonCode, (snapshot, _session, now) => {
      const workflow = snapshot.workflow;
      if (!workflow) {
        throwTakeoverWorkflowError("takeover.workflow_missing", { taskId: snapshot.task.id });
      }

      const target = resolveWorkflowStepTarget(workflow.workflowId, workflow.currentStepIndex, {
        ...(input.stepId !== undefined ? { stepId: input.stepId } : {}),
        ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
      });
      const outputs = parseOutputs(workflow.outputsJson);
      const normalizedOutputJson = normalizeJson(input.outputJson, "takeover.output_json_invalid");
      const parsedOutput = JSON.parse(normalizedOutputJson) as unknown;
      const status = input.status ?? "succeeded";

      // R14-6/R14-7: Validate step output before storing
      this.validateStepOutput(parsedOutput, target.step.stepId!, status);

      const summary = input.summary ?? resolveManualStepOutputSummary(target.step.stepId!, parsedOutput);

      // Store the output keyed by the step's outputKey
      outputs[target.step.outputKey] = parsedOutput;

      // Insert step output record with manual override flag
      this.store.workflow.insertStepOutput({
        id: newId("step"),
        nodeRunId: newId("noderun"),
        taskId: snapshot.task.id,
        stepId: target.step.stepId!,
        roleId: target.step.roleId,
        status,
        dataJson: normalizedOutputJson,
        summary,
        artifactsJson: JSON.stringify([]),
        tokenCost: 0,
        durationMs: 0,
        validationJson: JSON.stringify({ manualOverride: true, status }),
        producedAt: now,
      });

      // Update workflow outputs with the new step output
      this.store.workflow.updateWorkflowRecoveryState({
        taskId: snapshot.task.id,
        status: workflow.status,
        currentStepIndex: workflow.currentStepIndex,
        outputsJson: JSON.stringify(outputs),
        updatedAt: now,
        resumableFromStep: workflow.resumableFromStep,
        retryCount: workflow.retryCount,
        lastErrorCode: workflow.lastErrorCode,
      });

      // Emit step completed event for downstream consumers
      this.store.event.createTier1StatusEvent({
        taskId: snapshot.task.id,
        executionId: snapshot.execution?.id ?? null,
        eventType: "workflow:step_completed",
        traceId: newId("trace"),
        payload: {
          stepId: target.step.stepId,
          roleId: target.step.roleId,
          status,
          manualOverride: true,
          outputKey: target.step.outputKey,
        },
      });

      return {
        payload: {
          stepId: target.step.stepId,
          stepIndex: target.stepIndex,
          status,
          outputKey: target.step.outputKey,
        },
        executionId: snapshot.execution?.id ?? null,
      };
    }, input.tenantId);
  }

  /**
   * Skips the current workflow step, recording it as partial success.
   * If this was the final step, transitions the entire task to done.
   * Otherwise, advances the workflow to the next step.
   *
   * This allows operators to bypass steps that cannot be executed in the
   * current environment or are otherwise not needed.
   */
  public skipCurrentStep(input: {
    takeoverSessionId: string;
    note?: string;
    reasonCode: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "skip_step", input.reasonCode, (snapshot, session, now) => {
      if (!snapshot.workflow) {
        throwTakeoverWorkflowError("takeover.workflow_missing", { taskId: snapshot.task.id });
      }

      const workflow = snapshot.workflow;
      const definition = getWorkflowDefinition(workflow.workflowId);
      if (!definition) {
        throwTakeoverWorkflowError("takeover.workflow_definition_missing", { workflowId: workflow.workflowId });
      }

      const step = definition.steps[workflow.currentStepIndex];
      if (!step) {
        throwTakeoverWorkflowError("takeover.step_missing", {
          workflowId: workflow.workflowId,
          stepIndex: workflow.currentStepIndex,
        });
      }

      const outputs = parseOutputs(workflow.outputsJson);
      const manualOutput = {
        manualOverride: true,
        skipped: true,
        note: input.note ?? `Operator skipped ${step.stepId}`,
      };
      outputs[step.outputKey] = manualOutput;

      const stepOutput: StepOutputRecord = {
        id: newId("step"),
        nodeRunId: newId("noderun"),
        taskId: snapshot.task.id,
        stepId: step.stepId!,
        roleId: step.roleId,
        status: "partial_success",
        dataJson: JSON.stringify(manualOutput),
        summary: manualOutput.note,
        artifactsJson: JSON.stringify([]),
        tokenCost: 0,
        durationMs: 0,
        validationJson: JSON.stringify({ manualOverride: true, skipped: true }),
        producedAt: now,
      };
      const nextStepIndex = workflow.currentStepIndex + 1;
      const reachedTerminal = nextStepIndex >= definition.steps.length;

      // Record the skipped step output
      this.store.workflow.insertStepOutput(stepOutput);

      // Emit step completed event
      this.store.event.createTier1StatusEvent({
        taskId: snapshot.task.id,
        executionId: snapshot.execution?.id ?? null,
        eventType: "workflow:step_completed",
        traceId: newId("trace"),
        payload: {
          stepId: step.stepId,
          roleId: step.roleId,
          status: "partial_success",
          manualOverride: true,
        },
      });

      // Handle terminal vs. non-terminal skip differently
      if (reachedTerminal) {
        // Final step skipped - complete the task with done status
        this.store.task.updateTaskOutput(snapshot.task.id, "done", JSON.stringify(manualOutput), now);
        this.store.task.setTaskState({
          taskId: snapshot.task.id,
          status: "done",
          updatedAt: now,
          errorCode: null,
          completedAt: now,
        });
        this.store.workflow.updateWorkflowRecoveryState({
          taskId: snapshot.task.id,
          status: "completed",
          currentStepIndex: nextStepIndex,
          outputsJson: JSON.stringify(outputs),
          updatedAt: now,
          resumableFromStep: null,
          retryCount: workflow.retryCount,
          lastErrorCode: null,
        });
        if (snapshot.session) {
          this.store.session.updateSessionStatus(snapshot.session.id, "completed", now);
        }
        if (snapshot.execution) {
          this.store.execution.updateExecutionStatus(snapshot.execution.id, "succeeded", now, null, now, null);
        }
        this.store.event.createTier1StatusEvent({
          taskId: snapshot.task.id,
          executionId: snapshot.execution?.id ?? null,
          eventType: "platform.harness_run.status_changed",
          traceId: newId("trace"),
          payload: {
            aggregateType: "harness_run",
            fromStatus: snapshot.task.status,
            toStatus: "done",
            reasonCode: input.reasonCode,
            emittedBy: "human_takeover_service",
          },
        });
        this.store.approval.closeTakeoverSession(session.id, now);
      } else {
        // Non-terminal step skipped - advance to next step
        this.store.workflow.updateWorkflowRecoveryState({
          taskId: snapshot.task.id,
          status: "running",
          currentStepIndex: nextStepIndex,
          outputsJson: JSON.stringify(outputs),
          updatedAt: now,
          resumableFromStep: definition.steps[nextStepIndex]?.stepId ?? null,
          retryCount: workflow.retryCount,
          lastErrorCode: null,
        });
      }

      return {
        payload: {
          skippedStepId: step.stepId,
          nextStepIndex,
          reachedTerminal,
        },
        executionId: snapshot.execution?.id ?? null,
      };
    }, input.tenantId);
  }

  /**
   * Completes a task with a specified terminal status (done, failed, or cancelled).
   * The operator can optionally provide output JSON to store with the task.
   * Closes the takeover session after completing the task.
   *
   * This is the primary mechanism for operators to terminate tasks
   * that cannot be completed through normal execution.
   */
  public completeTask(input: {
    takeoverSessionId: string;
    terminalStatus: TaskTerminalStatus;
    reasonCode: string;
    outputJson?: string;
    tenantId?: string | null;
  }): TakeoverActionResult {
    return this.recordAction(input.takeoverSessionId, "complete_task", input.reasonCode, (snapshot, session, now) => {
      const workflowTerminal = workflowTerminalForTask(input.terminalStatus);
      const sessionTerminal = sessionTerminalForTask(input.terminalStatus);
      const executionTerminal = executionTerminalForTask(input.terminalStatus);

      // Optionally update task output
      if (input.outputJson) {
        this.store.task.updateTaskOutput(snapshot.task.id, input.terminalStatus, input.outputJson, now);
      }

      // Set task to the terminal state
      this.store.task.setTaskState({
        taskId: snapshot.task.id,
        status: input.terminalStatus,
        updatedAt: now,
        errorCode: input.terminalStatus === "failed" ? input.reasonCode : null,
        completedAt: now,
      });

      // Update workflow recovery state if workflow exists
      if (snapshot.workflow) {
        this.store.workflow.updateWorkflowRecoveryState({
          taskId: snapshot.task.id,
          status: workflowTerminal,
          currentStepIndex: snapshot.workflow.currentStepIndex,
          outputsJson: snapshot.workflow.outputsJson,
          updatedAt: now,
          resumableFromStep: null,
          retryCount: snapshot.workflow.retryCount,
          lastErrorCode: input.terminalStatus === "failed" ? input.reasonCode : null,
        });
      }

      // Close session and execution with appropriate terminal states
      if (snapshot.session) {
        this.store.session.updateSessionStatus(snapshot.session.id, sessionTerminal, now);
      }
      if (snapshot.execution) {
        this.store.execution.updateExecutionStatus(
          snapshot.execution.id,
          executionTerminal,
          now,
          null,
          now,
          input.terminalStatus === "failed" ? input.reasonCode : null,
        );
      }
      this.store.approval.closeTakeoverSession(session.id, now);

      // Emit harness run status changed event with manual override flag
      this.store.event.createTier1StatusEvent({
        taskId: snapshot.task.id,
        executionId: snapshot.execution?.id ?? null,
        eventType: "platform.harness_run.status_changed",
        traceId: newId("trace"),
        payload: {
          aggregateType: "harness_run",
          fromStatus: snapshot.task.status,
          toStatus: input.terminalStatus,
          reasonCode: input.reasonCode,
          emittedBy: "human_takeover_service",
        },
      });

      return {
        payload: {
          terminalStatus: input.terminalStatus,
        },
        executionId: snapshot.execution?.id ?? null,
      };
    }, input.tenantId);

    // R14-5/R14-15: Emit resume OperationalDirective only if task is not reaching a terminal state
    // Resume should only be emitted if the task can continue execution
    const terminalStatuses: readonly TaskTerminalStatus[] = ["done", "failed", "cancelled"];
    const shouldResume = !terminalStatuses.includes(input.terminalStatus);

    if (shouldResume) {
      const sessionRecord = this.store.approval.getTakeoverSession(input.takeoverSessionId, input.tenantId);
      const session: TakeoverSessionRecord = sessionRecord as TakeoverSessionRecord;
      this.emitResumeDirective(session.taskId, session.executionId, session.operatorId, input.reasonCode);
    }
  }

  /**
   * Internal helper that records an operator action within a takeover session.
   * Captures before/after state snapshots and emits audit events.
   * All public action methods delegate to this to ensure consistent audit trails.
   *
   * The method loads the current state before the mutation, applies the mutation
   * within a database transaction, then captures the after state for comparison.
   */
  private recordAction(
    takeoverSessionId: string,
    actionType: OperatorActionType,
    reasonCode: string,
    mutate: (
      snapshot: TaskSnapshot,
      session: TakeoverSessionRecord,
      now: string,
    ) => { payload: Record<string, unknown>; executionId: string | null },
    tenantId?: string | null,
  ): TakeoverActionResult {
    const session = this.requireOpenSession(takeoverSessionId, tenantId);
    const before = this.store.operations.loadTaskSnapshot(session.taskId, tenantId);
    const operatorActionId = newId("opact");
    const now = nowIso();

    let executionId: string | null = before.execution?.id ?? null;

    this.db.transaction(() => {
      // Apply the mutation which modifies store state
      const mutation = mutate(before, session, now);
      executionId = mutation.executionId;

      // Load state after mutation for before/after comparison in audit log
      const after = this.store.operations.loadTaskSnapshot(session.taskId, tenantId);

      // Record the operator action with before/after state for full traceability
      this.store.approval.insertOperatorAction({
        id: operatorActionId,
        takeoverSessionId,
        taskId: session.taskId,
        executionId,
        operatorId: session.operatorId,
        actionType,
        reasonCode,
        actionPayloadJson: JSON.stringify(mutation.payload),
        beforeStateJson: JSON.stringify(serializeSnapshot(before)),
        afterStateJson: JSON.stringify(serializeSnapshot(after)),
        createdAt: now,
      });

      // Emit event for event bus consumers to react to takeover actions
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: session.taskId,
        executionId,
        eventType: "takeover:action_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          takeoverSessionId,
          operatorActionId,
          actionType,
          reasonCode,
          ...mutation.payload,
        }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    return {
      taskId: session.taskId,
      executionId,
      takeoverSessionId,
      operatorActionId,
    };
  }

  /**
   * Retrieves an active takeover session, throwing if not found or already closed.
   * Only open sessions can accept operator actions.
   */
  private requireOpenSession(takeoverSessionId: string, tenantId?: string | null): TakeoverSessionRecord {
    const session = this.store.approval.getTakeoverSession(takeoverSessionId, tenantId);
    if (!session) {
      throwTakeoverStorageError("takeover.session_not_found", { takeoverSessionId, tenantId: tenantId ?? null });
    }
    if (session.status !== "open") {
      throwTakeoverWorkflowError("takeover.session_closed", {
        takeoverSessionId,
        sessionStatus: session.status,
      });
    }
    return session;
  }

  /**
   * R14-4: Emits a pause OperationalDirective when human takeover session is opened.
   * This notifies downstream systems that execution should be paused.
   */
  private emitPauseDirective(taskId: string, executionId: string | null, operatorId: string, reasonCode: string): void {
    if (this.directiveSink == null) {
      return;
    }

    const directive = createOperationalDirective({
      type: "pause",
      scope: {
        ...(executionId != null ? { harnessRunId: executionId } : {}),
      },
      issuedBy: {
        principalId: operatorId,
        tenantId: "tenant:local",
        roles: ["human_operator"],
      },
      reason: `human_takeover:${reasonCode}`,
      params: {
        taskId,
        executionId,
        operatorId,
        takeoverAction: "pause",
      },
    });
    this.directiveSink.emitOperationalDirective(directive);
  }

  /**
   * R14-5: Emits a resume OperationalDirective when human takeover is resolved.
   * This notifies downstream systems that execution can resume.
   */
  private emitResumeDirective(taskId: string, executionId: string | null, operatorId: string, reasonCode: string): void {
    if (this.directiveSink == null) {
      return;
    }

    const directive = createOperationalDirective({
      type: "resume",
      scope: {
        ...(executionId != null ? { harnessRunId: executionId } : {}),
      },
      issuedBy: {
        principalId: operatorId,
        tenantId: "tenant:local",
        roles: ["human_operator"],
      },
      reason: `human_takeover_resolved:${reasonCode}`,
      params: {
        taskId,
        executionId,
        operatorId,
        takeoverAction: "resume",
      },
    });
    this.directiveSink.emitOperationalDirective(directive);
  }

  /**
   * R14-6/R14-7: Validates step output before storing.
   * Ensures the output is a non-null object and conforms to basic validation rules.
   * Throws ValidationError if the output is invalid.
   */
  private validateStepOutput(output: unknown, stepId: string, status: StepOutputRecord["status"]): void {
    // Null/undefined is only allowed for skipped steps
    if (output == null) {
      if (status !== "skipped" && status !== "partial_success") {
        throw new ValidationError(
          "takeover.step_output_invalid",
          "Step output cannot be null or undefined unless explicitly skipped",
          { retryable: false, details: { stepId, status } },
        );
      }
      return;
    }

    // Output must be an object (not an array) for most step types
    if (Array.isArray(output)) {
      throw new ValidationError(
        "takeover.step_output_invalid",
        "Step output cannot be an array",
        { retryable: false, details: { stepId, outputType: "array" } },
      );
    }

    if (typeof output !== "object") {
      throw new ValidationError(
        "takeover.step_output_invalid",
        "Step output must be an object",
        { retryable: false, details: { stepId, outputType: typeof output } },
      );
    }

    // For failed steps, allow error-like objects
    if (status === "failed") {
      const errorObj = output as Record<string, unknown>;
      if (typeof errorObj.error !== "string" && typeof errorObj.message !== "string") {
        throw new ValidationError(
          "takeover.step_output_invalid",
          "Failed step output must contain an 'error' or 'message' field",
          { retryable: false, details: { stepId } },
        );
      }
    }

    // For succeeded steps, ensure basic structure is present
    if (status === "succeeded" || status === "partial_success") {
      const outputObj = output as Record<string, unknown>;
      // Allow any object structure for succeeded steps, but warn if it's empty
      if (Object.keys(outputObj).length === 0 && status === "succeeded") {
        throw new ValidationError(
          "takeover.step_output_invalid",
          "Succeeded step output cannot be an empty object",
          { retryable: false, details: { stepId } },
        );
      }
    }
  }

}
