/**
 * Inspect Service
 */

export * from "./inspect-service-support.js";

import type {
  CompactionRecord,
  FileLockRecord,
  MessageRecord,
  RemoteLogRecord,
  TaskRecord,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { RuntimeRecoveryService } from "../../execution/recovery/runtime-recovery-service-root.js";
import { toWorkerSchedulingStatus } from "../../execution/worker-pool/worker-scheduling-status.js";
import { buildTaskResultEnvelope } from "../../contracts/result-envelope/result-envelope.js";
import {
  buildLeaseHandoverSummary,
  buildRemoteRoutingSummary,
  buildStepResultEnvelopes,
  enrichDispatchDecisionTrace,
  findActiveExecutionId,
  normalizeLimit,
  parseApprovalDecisionSummary,
  parseApprovalRequestSummary,
  parseDispatchDecisionTraceFromEvent,
  parseJsonArray,
  type ApprovalInspectView,
  type DecisionInspectQuery,
  type DecisionInspectSummary,
  type ExecutionInspectView,
  type TaskInspectQuery,
  type TaskInspectSummary,
  type TaskInspectView,
  type WorkerInspectQuery,
  type WorkerInspectSummary,
  type WorkflowInspectQuery,
  type WorkflowInspectSummary,
} from "./inspect-service-support.js";


export class InspectService {
  private readonly runtimeRecovery: RuntimeRecoveryService;

  public constructor(private readonly store: AuthoritativeTaskStore) {
    this.runtimeRecovery = new RuntimeRecoveryService(store);
  }

  /**
   * Builds a comprehensive inspect view for a task, including all related records.
   * The recovery summary indicates whether there's an active execution and if the
   * task has reached a terminal state.
   * @param taskId - The ID of the task to inspect
   * @param tenantId - Optional tenant ID for tenant-scoped access control
   * @returns Complete task inspect view with all associated records
   */
  public getTaskInspectView(taskId: string, tenantId?: string | null): TaskInspectView {
    const snapshot = this.store.operations.loadTaskSnapshot(taskId, tenantId);
    const stepResults = buildStepResultEnvelopes(snapshot.stepOutputs, snapshot.artifacts);
    const dispatchDecisions = this.store.event.listDispatchDecisionTracesByTask(taskId).map(enrichDispatchDecisionTrace);
    const leaseHandoverSummary = buildLeaseHandoverSummary(snapshot.events);
    return {
      task: snapshot.task,
      workflowState: snapshot.workflow,
      execution: snapshot.execution,
      session: snapshot.session,
      approvals: this.store.approval.listApprovalsByTask(taskId),
      takeoverSessions: this.store.approval.listTakeoverSessionsByTask(taskId),
      operatorActions: this.store.approval.listOperatorActionsByTask(taskId),
      agentExecutions: this.store.worker.listAgentExecutionRecordsByTask(taskId),
      dispatchDecisions,
      remoteRoutingSummary: buildRemoteRoutingSummary(dispatchDecisions),
      leaseHandoverSummary,
      recentEvents: snapshot.events,
      stepOutputs: snapshot.stepOutputs,
      stepResults,
      taskResult: buildTaskResultEnvelope({
        task: snapshot.task,
        workflowState: snapshot.workflow,
        stepOutputs: snapshot.stepOutputs,
        artifacts: snapshot.artifacts,
      }),
      artifacts: snapshot.artifacts,
      runtimeRecovery: this.runtimeRecovery.buildRuntimeRecoveryView(taskId),
      recoverySummary: {
        activeExecutionId:
          snapshot.execution && !["succeeded", "failed", "cancelled", "superseded"].includes(snapshot.execution.status)
            ? snapshot.execution.id
            : null,
        hasTerminalTask: ["done", "failed", "cancelled"].includes(snapshot.task.status),
        lastTakeoverActionType: this.store.approval.listOperatorActionsByTask(taskId).at(-1)?.actionType ?? null,
      },
    };
  }

  /**
   * Builds a comprehensive inspect view for a specific execution, including
   * the execution record, all executions for the task, and all related records.
   * @param executionId - The ID of the execution to inspect
   * @returns Complete execution inspect view
   * @throws Error if execution not found
   */
  public getExecutionInspectView(executionId: string): ExecutionInspectView {
    const execution = this.store.dispatch.getExecution(executionId);
    if (!execution) {
      throw new ValidationError("inspect.execution_not_found", `Execution not found: ${executionId}`, {
        details: { executionId },
      });
    }

    const snapshot = this.store.operations.loadTaskSnapshot(execution.taskId);
    const stepResults = buildStepResultEnvelopes(snapshot.stepOutputs, snapshot.artifacts);
    const dispatchDecisions = this.store
      .listDispatchDecisionTracesByExecution(executionId)
      .map(enrichDispatchDecisionTrace);
    const recentEvents = snapshot.events.filter((event) => event.executionId === executionId || event.executionId === null);
    return {
      task: snapshot.task,
      workflowState: snapshot.workflow,
      execution,
      executions: this.store.execution.listExecutionsByTask(execution.taskId),
      session: snapshot.session,
      approvals: this.store.approval.listApprovalsByTask(execution.taskId),
      takeoverSessions: this.store.approval.listTakeoverSessionsByTask(execution.taskId),
      operatorActions: this.store.approval.listOperatorActionsByTask(execution.taskId),
      agentExecution: this.store.worker.getAgentExecutionRecord(executionId) ?? null,
      dispatchDecisions,
      remoteRoutingSummary: buildRemoteRoutingSummary(dispatchDecisions),
      leaseHandoverSummary: buildLeaseHandoverSummary(recentEvents),
      // Filter events to those specific to this execution or task-level (null executionId)
      recentEvents,
      stepOutputs: snapshot.stepOutputs,
      stepResults,
      taskResult: buildTaskResultEnvelope({
        task: snapshot.task,
        workflowState: snapshot.workflow,
        stepOutputs: snapshot.stepOutputs,
        artifacts: snapshot.artifacts,
      }),
      artifacts: snapshot.artifacts,
      runtimeRecovery: this.runtimeRecovery.buildRuntimeRecoveryView(execution.taskId),
    };
  }

  /**
   * Builds a focused inspect view for a specific approval, including the approval
   * record and relevant context for approval review.
   * @param approvalId - The ID of the approval to inspect
   * @returns Approval inspect view with context
   * @throws Error if approval not found
   */
  public getApprovalInspectView(approvalId: string): ApprovalInspectView {
    const approval = this.store.approval.getApproval(approvalId);
    if (!approval) {
      throw new ValidationError("inspect.approval_not_found", `Approval not found: ${approvalId}`, {
        details: { approvalId },
      });
    }

    const snapshot = this.store.operations.loadTaskSnapshot(approval.taskId);
    const execution = approval.executionId != null ? this.store.dispatch.getExecution(approval.executionId) : snapshot.execution;
    const stepResults = buildStepResultEnvelopes(snapshot.stepOutputs, snapshot.artifacts);
    const dispatchDecisions =
      approval.executionId == null
        ? []
        : this.store.event.listDispatchDecisionTracesByExecution(approval.executionId).map(enrichDispatchDecisionTrace);
    const recentEvents = snapshot.events.filter(
      (event) => event.eventType.startsWith("decision:") || event.executionId === approval.executionId,
    );

    return {
      task: snapshot.task,
      workflowState: snapshot.workflow,
      execution,
      session: snapshot.session,
      approval,
      approvals: this.store.approval.listApprovalsByTask(approval.taskId),
      operatorActions: this.store.approval.listOperatorActionsByTask(approval.taskId),
      agentExecution: approval.executionId == null ? null : this.store.worker.getAgentExecutionRecord(approval.executionId) ?? null,
      dispatchDecisions,
      remoteRoutingSummary: buildRemoteRoutingSummary(dispatchDecisions),
      leaseHandoverSummary: buildLeaseHandoverSummary(recentEvents),
      recentEvents,
      stepResults,
      taskResult: buildTaskResultEnvelope({
        task: snapshot.task,
        workflowState: snapshot.workflow,
        stepOutputs: snapshot.stepOutputs,
        artifacts: snapshot.artifacts,
      }),
      artifacts: snapshot.artifacts,
      runtimeRecovery: this.runtimeRecovery.buildRuntimeRecoveryView(approval.taskId),
    };
  }

  public queryTaskInspectSummaries(query: TaskInspectQuery = {}): TaskInspectSummary[] {
    const limit = normalizeLimit(query.limit, 25);
    // R14-18: Pass tenantId to store's listTasks for SQL-level filtering instead of
    // fetching all 200 items and filtering in memory. This reduces memory usage and
    // improves performance significantly for multi-tenant deployments.
    return this.store
      .listTasks(limit, query.tenantId ?? undefined)
      .map((task) => this.buildTaskInspectSummary(task))
      .filter((summary) => {
        if (query.taskStatus && summary.taskStatus !== query.taskStatus) {
          return false;
        }
        if (query.workflowStatus && summary.workflowStatus !== query.workflowStatus) {
          return false;
        }
        if (query.workflowId && summary.workflowId !== query.workflowId) {
          return false;
        }
        if (query.divisionId && summary.divisionId !== query.divisionId) {
          return false;
        }
        if (typeof query.hasPendingApproval === "boolean") {
          return query.hasPendingApproval ? summary.pendingApprovalCount > 0 : summary.pendingApprovalCount === 0;
        }
        return true;
      });
  }

  public queryWorkflowInspectSummaries(query: WorkflowInspectQuery = {}): WorkflowInspectSummary[] {
    const limit = normalizeLimit(query.limit, 25);
    const tenantTaskIds =
      query.tenantId === undefined
        ? null
        : new Set(
            this.store
              .listTasks()
              .filter((task) => (task.tenantId ?? null) === query.tenantId)
              .map((task) => task.id),
          );
    return this.store
      .listWorkflowStates(query.tenantId)
      .map((workflow) => this.buildWorkflowInspectSummary(workflow))
      .filter((summary): summary is WorkflowInspectSummary => summary != null)
      .filter((summary) => {
        if (tenantTaskIds != null && !tenantTaskIds.has(summary.taskId)) {
          return false;
        }
        if (query.workflowId && summary.workflowId !== query.workflowId) {
          return false;
        }
        if (query.workflowStatus && summary.workflowStatus !== query.workflowStatus) {
          return false;
        }
        if (query.divisionId && summary.divisionId !== query.divisionId) {
          return false;
        }
        if (query.taskStatus && summary.taskStatus !== query.taskStatus) {
          return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  public queryDecisionInspectSummaries(query: DecisionInspectQuery = {}): DecisionInspectSummary[] {
    const limit = normalizeLimit(query.limit, 50);
    const summaries = this.store
      .listTasks()
      .filter((task) => query.tenantId === undefined || (task.tenantId ?? null) === query.tenantId)
      .flatMap((task) => this.buildDecisionSummariesForTask(task.id));
    return summaries
      .filter((summary) => {
        if (query.decisionType && summary.decisionType !== query.decisionType) {
          return false;
        }
        if (query.status && summary.status !== query.status) {
          return false;
        }
        if (query.taskId && summary.taskId !== query.taskId) {
          return false;
        }
        if (query.executionId && summary.executionId !== query.executionId) {
          return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  public queryWorkerInspectSummaries(query: WorkerInspectQuery = {}): WorkerInspectSummary[] {
    const limit = normalizeLimit(query.limit, 50);
    return this.store
      .listWorkerSnapshots()
      .map((worker) => {
        const runningExecutionCount = parseJsonArray(worker.runningExecutionsJson).length;
        return {
          workerId: worker.workerId,
          status: worker.status,
          schedulingStatus: toWorkerSchedulingStatus(worker.status),
          placement: worker.placement ?? "local",
          isolationLevel: worker.isolationLevel ?? "standard",
          repoVersion: worker.repoVersion ?? null,
          remoteSessionStatus: worker.remoteSessionStatus ?? null,
          lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset ?? null,
          streamResumeSuccessRate: worker.streamResumeSuccessRate ?? null,
          credentialRefreshSuccessRate: worker.credentialRefreshSuccessRate ?? null,
          sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus ?? null,
          sessionConsistencyCheckedAt: worker.sessionConsistencyCheckedAt ?? null,
          saturation: worker.saturation ?? null,
          activeLeaseCount: worker.activeLeaseCount ?? 0,
          meanStartupLatencyMs: worker.meanStartupLatencyMs ?? null,
          sandboxSuccessRate: worker.sandboxSuccessRate ?? null,
          repoCacheHitRate: worker.repoCacheHitRate ?? null,
          maxConcurrency: worker.maxConcurrency,
          runningExecutionCount,
          availableSlots: Math.max(worker.maxConcurrency - runningExecutionCount, 0),
          queueAffinity: worker.queueAffinity,
          lastHeartbeatAt: worker.lastHeartbeatAt,
          updatedAt: worker.updatedAt,
        };
      })
      .filter((summary) => {
        if (query.status && summary.status !== query.status) {
          return false;
        }
        if (query.placement && summary.placement !== query.placement) {
          return false;
        }
        if (query.remoteSessionStatus && summary.remoteSessionStatus !== query.remoteSessionStatus) {
          return false;
        }
        if (query.queueAffinity && summary.queueAffinity !== query.queueAffinity) {
          return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  /**
   * Lists all session messages for a task by finding the session and fetching
   * its messages from the store.
   * @param taskId - The ID of the task whose session messages to list
   * @returns Array of message records for the task's session
   */
  public listSessionMessages(taskId: string): MessageRecord[] {
    const snapshot = this.store.operations.loadTaskSnapshot(taskId);
    return snapshot.session == null ? [] : this.store.dispatch.listMessagesBySession(snapshot.session.id);
  }

  /**
   * Lists all compaction records for a task's session.
   * @param taskId - The ID of the task whose compaction records to list
   * @returns Array of compaction records for the task's session
   */
  public listSessionCompactionRecords(taskId: string): CompactionRecord[] {
    const snapshot = this.store.operations.loadTaskSnapshot(taskId);
    return snapshot.session == null ? [] : this.store.session.listCompactionRecordsBySession(snapshot.session.id);
  }

  /**
   * Lists all file locks currently held by a task.
   * @param taskId - The ID of the task whose file locks to list
   * @returns Array of file lock records for the task
   */
  public listFileLocksByTask(taskId: string): FileLockRecord[] {
    return this.store.lock.listFileLocksByTask(taskId);
  }

  public listRemoteLogsByTask(taskId: string): RemoteLogRecord[] {
    return this.store.worker.listRemoteLogsByTask(taskId);
  }

  private buildTaskInspectSummary(task: TaskRecord): TaskInspectSummary {
    const workflow = this.store.workflow.getWorkflowState(task.id);
    const executions = this.store.execution.listExecutionsByTask(task.id);
    const approvals = this.store.approval.listApprovalsByTask(task.id);
    const session = this.store.operations.loadTaskSnapshot(task.id).session;
    const events = this.store.event.listEventsForTask(task.id);

    return {
      taskId: task.id,
      title: task.title,
      divisionId: task.divisionId,
      priority: task.priority,
      taskStatus: task.status,
      workflowId: workflow?.workflowId ?? null,
      workflowStatus: workflow?.status ?? null,
      currentStepIndex: workflow?.currentStepIndex ?? null,
      sessionStatus: session?.status ?? null,
      activeExecutionId: findActiveExecutionId(executions),
      latestExecutionStatus: executions.at(-1)?.status ?? null,
      pendingApprovalCount: approvals.filter((approval) => approval.status === "requested").length,
      resolvedApprovalCount: approvals.filter((approval) => approval.status !== "requested").length,
      dispatchDecisionCount: events.filter((event) => event.eventType === "dispatch:decision_recorded").length,
      latestEventAt: events.at(-1)?.createdAt ?? null,
      updatedAt: task.updatedAt,
    };
  }

  private buildWorkflowInspectSummary(workflow: WorkflowStateRecord): WorkflowInspectSummary | null {
    const task = this.store.task.getTask(workflow.taskId);
    if (!task) {
      return null;
    }

    const executions = this.store.execution.listExecutionsByTask(workflow.taskId);
    const approvals = this.store.approval.listApprovalsByTask(workflow.taskId);
    const events = this.store.event.listEventsForTask(workflow.taskId);

    return {
      taskId: workflow.taskId,
      divisionId: workflow.divisionId,
      workflowId: workflow.workflowId,
      workflowStatus: workflow.status,
      currentStepIndex: workflow.currentStepIndex,
      retryCount: workflow.retryCount,
      resumableFromStep: workflow.resumableFromStep,
      lastErrorCode: workflow.lastErrorCode,
      taskStatus: task.status,
      activeExecutionId: findActiveExecutionId(executions),
      pendingApprovalCount: approvals.filter((approval) => approval.status === "requested").length,
      latestEventAt: events.at(-1)?.createdAt ?? null,
      updatedAt: workflow.updatedAt,
    };
  }

  private buildDecisionSummariesForTask(taskId: string): DecisionInspectSummary[] {
    const workflow = this.store.workflow.getWorkflowState(taskId);
    const approvals = this.store.approval.listApprovalsByTask(taskId).map((approval) => {
      const request = parseApprovalRequestSummary(approval.requestJson);
      const decision = parseApprovalDecisionSummary(approval.responseJson);
      return {
        decisionType: "approval" as const,
        decisionId: approval.id,
        taskId: approval.taskId,
        executionId: approval.executionId,
        workflowId: workflow?.workflowId ?? null,
        status: approval.status,
        reasonCode: decision.decisionType,
        sourceAgentId: request.sourceAgentId,
        actorId: decision.respondedBy,
        riskLevel: request.riskLevel,
        selectedWorkerId: null,
        queueName: null,
        cascadeDeny: decision.cascadeDeny,
        createdAt: approval.createdAt,
        respondedAt: approval.respondedAt,
      };
    });
    const dispatchDecisions = this.store
      .listEventsForTask(taskId)
      .flatMap((event) => {
        const decision = parseDispatchDecisionTraceFromEvent(event);
        if (!decision) {
          return [];
        }

        const execution = this.store.dispatch.getExecution(decision.executionId);
        return [
          {
            decisionType: "dispatch" as const,
            decisionId: decision.ticketId,
            taskId: decision.taskId,
            executionId: decision.executionId,
            workflowId: execution?.workflowId ?? workflow?.workflowId ?? null,
            status: decision.outcome,
            reasonCode: decision.reasonCode,
            sourceAgentId: execution?.agentId ?? null,
            actorId: null,
            riskLevel: null,
            selectedWorkerId: decision.selectedWorkerId,
            queueName: decision.queueName,
            cascadeDeny: false,
            createdAt: event.createdAt,
            respondedAt: null,
          },
        ];
      });

    return [...dispatchDecisions, ...approvals].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
