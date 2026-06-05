import type {
  AgentDTO,
  AnalyticsMetricDTO,
  ApprovalDTO,
  CostReportDTO,
  DashboardSnapshotDTO,
  DivisionInventorySnapshotDTO,
  DomainConfigDTO,
  ExplanationDTO,
  FeatureFlagDTO,
  HealthStatusReportDTO,
  IncidentDTO,
  LeadershipClaimsConsoleDTO,
  KnowledgeItemDTO,
  MarketplacePackDTO,
  MissionBudgetSummaryDTO,
  MissionDTO,
  MissionMemberDTO,
  MissionResourceDTO,
  ModelConfigDTO,
  PackVersionDTO,
  PluginDTO,
  PromptDTO,
  QueueDTO,
  RoleDTO,
  SystemConfigDTO,
  TaskDTO,
  TenantDTO,
  UserDTO,
  UserPreferenceDTO,
  WebhookDTO,
  WorkerDTO,
  WorkflowRunStepDTO,
  WorkflowDTO,
} from "@aa/shared-types";
import type { RESTClient, RestRequestOptions } from "./rest-client";

export interface ListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly filter?: string;
}

export interface CreateTaskInput {
  readonly [key: string]: unknown;
  readonly id?: string;
  readonly title: string;
  readonly domainId?: string;
  readonly divisionId?: string;
  readonly owner?: string;
  readonly status?: string;
  readonly parentId?: string;
  readonly inputJson?: string;
  readonly priority?: "low" | "normal" | "high" | "urgent";
  readonly source?: "user" | "perception" | "system";
}

export interface CreateTaskResponse {
  readonly snapshot?: {
    readonly task?: {
      readonly id?: string;
    };
  };
}

export interface UpdateIncidentInput {
  readonly status?: "acknowledged" | "mitigating" | "resolved" | "closed";
  readonly owner?: string;
  readonly snoozedUntil?: string | null;
}

export interface EndpointDefinition<
  TResponse = unknown,
  TRequestBody = never,
  TPathParams = never,
  TQueryParams = never,
> {
  readonly id: string;
  readonly path: string;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly apiLayer: "A" | "B" | "C";
  readonly planned: boolean;
  readonly __responseType?: TResponse;
  readonly __requestBodyType?: TRequestBody;
  readonly __pathParamsType?: TPathParams;
  readonly __queryParamsType?: TQueryParams;
}

export type EndpointResponse<TEndpoint extends EndpointDefinition> =
  TEndpoint extends EndpointDefinition<infer TResponse, never, never, never>
    ? TResponse
    : TEndpoint extends EndpointDefinition<infer TResponse, unknown, unknown, unknown>
      ? TResponse
      : never;

export type EndpointRequestBody<TEndpoint extends EndpointDefinition> =
  TEndpoint extends EndpointDefinition<unknown, infer TRequestBody, unknown, unknown>
    ? TRequestBody
    : never;

export type EndpointPathParams<TEndpoint extends EndpointDefinition> =
  TEndpoint extends EndpointDefinition<unknown, unknown, infer TPathParams, unknown>
    ? TPathParams
    : never;

export type EndpointQueryParams<TEndpoint extends EndpointDefinition> =
  TEndpoint extends EndpointDefinition<unknown, unknown, unknown, infer TQueryParams>
    ? TQueryParams
    : never;

type MutationAck<TBody = unknown> = { ok: true; body?: TBody };
type TaskPathParams = { taskId: string };
type WorkflowPathParams = { workflowId: string };
type WorkflowRunStepPathParams = { workflowRunId: string };
type ApprovalPathParams = { approvalId: string };
type IncidentPathParams = { incidentId: string };
type LeadershipClaimPathParams = { claimId: string };
type LeadershipClaimReviewRequestPathParams = { requestId: string };
type PackVersionPathParams = { packId: string };
type CompliancePolicyPathParams = { policyId: string };
type ComplianceExceptionPathParams = { exceptionId: string };
type UserPathParams = { userId: string };
type CompliancePolicySummary = { id: string; name: string; severity: string };
type AuditLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  outcome: string;
  metadata?: Record<string, unknown>;
};
type ComplianceExceptionVmDTO = {
  id: string;
  reason: string;
  policyId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  requestedBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rationale?: string;
};
type ComplianceExceptionResponse = { id: string };
type ContractVersionResponse = { contractVersion: string; minServerVersion?: string };
type TaskLikeRecord = Partial<TaskDTO> & {
  readonly taskId?: string;
  readonly taskStatus?: string;
  readonly divisionId?: string | null;
  readonly currentStepIndex?: number | null;
  readonly workflowStatus?: string | null;
  readonly latestExecutionStatus?: string | null;
  readonly sessionStatus?: string | null;
  readonly pendingApprovalCount?: number;
  readonly resolvedApprovalCount?: number;
  readonly activeExecutionId?: string | null;
};
type WorkflowLikeRecord = Partial<WorkflowDTO> & {
  readonly taskId?: string;
  readonly workflowId?: string;
  readonly workflowStatus?: string | null;
  readonly taskStatus?: string | null;
  readonly divisionId?: string | null;
  readonly currentStepIndex?: number | null;
  readonly resumableFromStep?: string | null;
};

function mapTaskStatus(status: string | undefined): TaskDTO["status"] {
  switch (status) {
    case "done":
      return "completed";
    case "in_progress":
    case "pending":
    case "prechecking":
    case "ready":
    case "dispatching":
    case "executing":
    case "resuming":
    case "recovering":
      return "running";
    case "awaiting_decision":
    case "paused":
    case "blocked":
      return "blocked";
    case "failed":
    case "timed_out":
    case "superseded":
    case "cancelled":
      return "failed";
    case "queued":
    default:
      return "queued";
  }
}

function normalizeTaskDto(task: TaskLikeRecord): TaskDTO {
  const currentStep =
    typeof task.currentStep === "string" && task.currentStep.length > 0
      ? task.currentStep
      : typeof task.currentStepIndex === "number"
        ? `step-${task.currentStepIndex}`
        : task.workflowStatus
          ?? task.latestExecutionStatus
          ?? task.sessionStatus
          ?? "intake";
  return {
    id: task.id ?? task.taskId ?? "task-unknown",
    title: task.title ?? "Untitled task",
    status: mapTaskStatus(task.status ?? task.taskStatus),
    domainId: task.domainId ?? task.divisionId ?? "platform",
    currentStep,
    ...(task.owner == null ? {} : { owner: task.owner }),
    ...(task.evidenceCount != null
      ? { evidenceCount: task.evidenceCount }
      : task.pendingApprovalCount != null || task.resolvedApprovalCount != null
        ? { evidenceCount: (task.pendingApprovalCount ?? 0) + (task.resolvedApprovalCount ?? 0) }
        : {}),
    ...(task.timelineDepth != null
      ? { timelineDepth: task.timelineDepth }
      : typeof task.currentStepIndex === "number"
        ? { timelineDepth: Math.max(1, task.currentStepIndex + 1) }
        : {}),
    ...(task.executionMode != null
      ? { executionMode: task.executionMode }
      : task.activeExecutionId != null
        ? { executionMode: "external" }
        : {}),
    ...(task.modelCallStatus == null ? {} : { modelCallStatus: task.modelCallStatus }),
    ...(task.modelProvider == null ? {} : { modelProvider: task.modelProvider }),
    ...(task.modelName == null ? {} : { modelName: task.modelName }),
    ...(task.outputSummary === undefined ? {} : { outputSummary: task.outputSummary }),
    ...(task.outputUri === undefined ? {} : { outputUri: task.outputUri }),
  };
}

function mapWorkflowStatus(status: string | null | undefined): WorkflowDTO["status"] {
  switch (status) {
    case "completed":
    case "done":
    case "failed":
    case "cancelled":
      return "completed";
    case "paused":
    case "awaiting_decision":
    case "blocked":
      return "paused";
    case "draft":
      return "draft";
    case "running":
    case "in_progress":
    case "pending":
    case "queued":
    default:
      return "running";
  }
}

function normalizeWorkflowDto(workflow: WorkflowLikeRecord): WorkflowDTO {
  const currentStage =
    typeof workflow.currentStage === "string" && workflow.currentStage.length > 0
      ? workflow.currentStage
      : typeof workflow.resumableFromStep === "string" && workflow.resumableFromStep.length > 0
        ? workflow.resumableFromStep
        : typeof workflow.currentStepIndex === "number"
          ? `step-${workflow.currentStepIndex}`
          : workflow.workflowStatus
            ?? "intake";
  return {
    id: workflow.id ?? workflow.taskId ?? workflow.workflowId ?? "workflow-unknown",
    title: workflow.title ?? workflow.workflowId ?? workflow.taskId ?? "Untitled workflow",
    status: mapWorkflowStatus(workflow.status ?? workflow.workflowStatus ?? workflow.taskStatus),
    currentStage,
    owner: workflow.owner ?? workflow.divisionId ?? "platform",
    steps: workflow.steps ?? [],
    ...(workflow.approvalNodes == null ? {} : { approvalNodes: workflow.approvalNodes }),
    ...(workflow.evidenceRefs == null ? {} : { evidenceRefs: workflow.evidenceRefs }),
  };
}

function mapTaskPatchStatus(status: unknown): string | undefined {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "paused":
      return "paused";
    case "awaiting_decision":
    case "prechecking":
    case "ready":
    case "dispatching":
    case "executing":
    case "resuming":
    case "recovering":
    case "timed_out":
    case "superseded":
      return status;
    default:
      return undefined;
  }
}

type EndpointCatalogDefinition = {
  healthReport: EndpointDefinition<HealthStatusReportDTO>;
  dashboardSnapshot: EndpointDefinition<DashboardSnapshotDTO>;
  tasks: EndpointDefinition<readonly TaskDTO[], never, never, ListQueryParams>;
  tasksCreate: EndpointDefinition<MutationAck<Partial<TaskDTO>>, Partial<TaskDTO>>;
  tasksUpdate: EndpointDefinition<MutationAck<Partial<TaskDTO>>, Partial<TaskDTO>, TaskPathParams>;
  tasksDelete: EndpointDefinition<MutationAck, never, TaskPathParams>;
  workflows: EndpointDefinition<readonly WorkflowDTO[], never, never, ListQueryParams>;
  workflowsCreate: EndpointDefinition<MutationAck<Partial<WorkflowDTO>>, Partial<WorkflowDTO>>;
  workflowsPause: EndpointDefinition<MutationAck<{ action: "pause" }>, { action: "pause" }, WorkflowPathParams>;
  workflowsResume: EndpointDefinition<
    MutationAck<{ action: "resume"; mode: "normal" | "replan" | "supervised" | "abort" }>,
    { action: "resume"; mode: "normal" | "replan" | "supervised" | "abort" },
    WorkflowPathParams
  >;
  workflowsRecover: EndpointDefinition<MutationAck<{ action: "recover" }>, { action: "recover" }, WorkflowPathParams>;
  workflowsRelease: EndpointDefinition<MutationAck<{ action: "release" }>, { action: "release" }, WorkflowPathParams>;
  workflowsPublish: EndpointDefinition<MutationAck<{ action: "publish" }>, { action: "publish" }, WorkflowPathParams>;
  workflowsDelete: EndpointDefinition<MutationAck, never, WorkflowPathParams>;
  workflowRunSteps: EndpointDefinition<readonly WorkflowRunStepDTO[], never, WorkflowRunStepPathParams>;
  approvals: EndpointDefinition<readonly ApprovalDTO[], never, never, ListQueryParams>;
  approvalsApprove: EndpointDefinition<MutationAck<{ decision: "approved" }>, { decision: "approved" }, ApprovalPathParams>;
  approvalsReject: EndpointDefinition<MutationAck<{ decision: "rejected" }>, { decision: "rejected" }, ApprovalPathParams>;
  approvalsDelegate: EndpointDefinition<MutationAck<{ delegateTo: string }>, { delegateTo: string }, ApprovalPathParams>;
  approvalsRequestContext: EndpointDefinition<
    MutationAck<{ action: "request_more_context" }>,
    { action: "request_more_context" },
    ApprovalPathParams
  >;
  approvalsEdit: EndpointDefinition<MutationAck<Record<string, unknown>>, Record<string, unknown>, ApprovalPathParams>;
  approvalsEscalate: EndpointDefinition<MutationAck<{ reason: string }>, { reason: string }, ApprovalPathParams>;
  approvalsDefer: EndpointDefinition<MutationAck<{ until: string }>, { until: string }, ApprovalPathParams>;
  approvalsTextInput: EndpointDefinition<MutationAck<{ input: string }>, { input: string }, ApprovalPathParams>;
  incidents: EndpointDefinition<readonly IncidentDTO[], never, never, ListQueryParams>;
  incidentsUpdate: EndpointDefinition<IncidentDTO, UpdateIncidentInput, IncidentPathParams>;
  workers: EndpointDefinition<readonly WorkerDTO[], never, never, ListQueryParams>;
  workersDrain: EndpointDefinition<
    { drainedWorkerIds: readonly string[]; drainedCount: number; totalWorkers: number; workers: readonly WorkerDTO[] },
    Record<string, never>
  >;
  queues: EndpointDefinition<readonly QueueDTO[], never, never, ListQueryParams>;
  queuesRetryCleanup: EndpointDefinition<
    { cleanedTaskIds: readonly string[]; invalidatedTicketIds: readonly string[]; cleanedCount: number; queues: readonly QueueDTO[]; total: number },
    Record<string, never>
  >;
  agents: EndpointDefinition<readonly AgentDTO[], never, never, ListQueryParams>;
  analytics: EndpointDefinition<readonly AnalyticsMetricDTO[], never, never, ListQueryParams>;
  costs: EndpointDefinition<readonly CostReportDTO[], never, never, ListQueryParams>;
  marketplace: EndpointDefinition<readonly MarketplacePackDTO[], never, never, ListQueryParams>;
  missions: EndpointDefinition<readonly MissionDTO[], never, never, ListQueryParams>;
  missionMembers: EndpointDefinition<readonly MissionMemberDTO[], never, { missionId: string }>;
  missionTasks: EndpointDefinition<readonly MissionResourceDTO[], never, { missionId: string }>;
  missionRuns: EndpointDefinition<readonly MissionResourceDTO[], never, { missionId: string }>;
  missionEvidence: EndpointDefinition<readonly MissionResourceDTO[], never, { missionId: string }>;
  missionKnowledge: EndpointDefinition<readonly MissionResourceDTO[], never, { missionId: string }>;
  missionLearning: EndpointDefinition<readonly MissionResourceDTO[], never, { missionId: string }>;
  missionBudget: EndpointDefinition<MissionBudgetSummaryDTO, never, { missionId: string }>;
  knowledge: EndpointDefinition<readonly KnowledgeItemDTO[], never, never, ListQueryParams>;
  packs: EndpointDefinition<readonly MarketplacePackDTO[], never, never, ListQueryParams>;
  packVersions: EndpointDefinition<readonly PackVersionDTO[], never, PackVersionPathParams>;
  plugins: EndpointDefinition<readonly PluginDTO[], never, never, ListQueryParams>;
  prompts: EndpointDefinition<readonly PromptDTO[], never, never, ListQueryParams>;
  explanations: EndpointDefinition<readonly ExplanationDTO[], never, never, ListQueryParams>;
  roles: EndpointDefinition<readonly RoleDTO[], never, never, ListQueryParams>;
  compliancePolicies: EndpointDefinition<readonly CompliancePolicySummary[]>;
  compliancePoliciesUpdate: EndpointDefinition<MutationAck<Record<string, unknown>>, Record<string, unknown>, CompliancePolicyPathParams>;
  auditLogs: EndpointDefinition<readonly AuditLogEntry[]>;
  complianceExceptionsList: EndpointDefinition<readonly ComplianceExceptionVmDTO[]>;
  complianceExceptions: EndpointDefinition<ComplianceExceptionResponse, { reason: string; policyId: string }>;
  complianceExceptionsApprove: EndpointDefinition<MutationAck<{ action: "approve" }>, { action: "approve" }, ComplianceExceptionPathParams>;
  complianceExceptionsReject: EndpointDefinition<MutationAck<{ rationale: string }>, { rationale: string }, ComplianceExceptionPathParams>;
  featureFlags: EndpointDefinition<readonly FeatureFlagDTO[], never, never, ListQueryParams>;
  models: EndpointDefinition<readonly ModelConfigDTO[], never, never, ListQueryParams>;
  domainConfigs: EndpointDefinition<readonly DomainConfigDTO[], never, never, ListQueryParams>;
  tenants: EndpointDefinition<readonly TenantDTO[], never, never, ListQueryParams>;
  users: EndpointDefinition<readonly UserDTO[], never, never, ListQueryParams>;
  usersCreate: EndpointDefinition<MutationAck<Partial<UserDTO>>, Partial<UserDTO>>;
  usersUpdate: EndpointDefinition<MutationAck<Partial<UserDTO>>, Partial<UserDTO>, UserPathParams>;
  systemConfig: EndpointDefinition<SystemConfigDTO>;
  webhooks: EndpointDefinition<readonly WebhookDTO[]>;
  preferences: EndpointDefinition<UserPreferenceDTO>;
  workflowBuilder: EndpointDefinition<readonly WorkflowDTO[]>;
  contractVersion: EndpointDefinition<ContractVersionResponse>;
  divisionInventorySnapshot: EndpointDefinition<DivisionInventorySnapshotDTO>;
  leadershipClaimsConsole: EndpointDefinition<LeadershipClaimsConsoleDTO>;
  leadershipClaimsReviewRequest: EndpointDefinition<
    { reviewRequest: { requestId: string; familyId: string; requestedBy: string; status: string } },
    {
      familyId: string;
      divisionId?: string;
      scenarioId?: string;
      requestedClaimLevel: string;
      requestedSurfaces: readonly string[];
      rationale: string;
    }
  >;
  leadershipClaimsApproveReviewRequest: EndpointDefinition<
    { reviewRequest: { requestId: string; status: string; reviewedBy: string | null } },
    { reasonCode: string; comment?: string },
    LeadershipClaimReviewRequestPathParams
  >;
  leadershipClaimsRejectReviewRequest: EndpointDefinition<
    { reviewRequest: { requestId: string; status: string; reviewedBy: string | null } },
    { reasonCode: string; comment?: string },
    LeadershipClaimReviewRequestPathParams
  >;
  leadershipClaimsRevoke: EndpointDefinition<
    {
      statusOverride: {
        claimId: string;
        status: string;
        reasonCode: string;
        revokedBy: string;
        revokedAt: string;
        replacementRequired: boolean;
      };
    },
    { reasonCode: string; comment?: string; replacementRequired: boolean },
    LeadershipClaimPathParams
  >;
};

export const endpointCatalog = {
  healthReport: { id: "meta.health", path: "/health", method: "GET", apiLayer: "A", planned: false },
  dashboardSnapshot: { id: "dashboard.snapshot", path: "/v1/dashboard/snapshot", method: "GET", apiLayer: "C", planned: false },
  tasks: { id: "tasks.list", path: "/v1/tasks", method: "GET", apiLayer: "C", planned: false },
  tasksCreate: { id: "tasks.create", path: "/v1/tasks", method: "POST", apiLayer: "C", planned: false },
  tasksUpdate: { id: "tasks.update", path: "/v1/tasks/:taskId", method: "PATCH", apiLayer: "C", planned: false },
  tasksDelete: { id: "tasks.delete", path: "/v1/tasks/:taskId", method: "DELETE", apiLayer: "C", planned: false },
  workflows: { id: "workflows.list", path: "/v1/workflows", method: "GET", apiLayer: "C", planned: false },
  workflowsCreate: { id: "workflows.create", path: "/v1/workflows", method: "POST", apiLayer: "C", planned: false },
  workflowsPause: { id: "workflows.pause", path: "/v1/workflows/:workflowId/pause", method: "POST", apiLayer: "C", planned: false },
  workflowsResume: { id: "workflows.resume", path: "/v1/workflows/:workflowId/resume", method: "POST", apiLayer: "C", planned: false },
  workflowsRecover: { id: "workflows.recover", path: "/v1/workflows/:workflowId/recover", method: "POST", apiLayer: "C", planned: false },
  workflowsRelease: { id: "workflows.release", path: "/v1/workflows/:workflowId/release", method: "POST", apiLayer: "C", planned: false },
  workflowsPublish: { id: "workflows.publish", path: "/v1/workflows/:workflowId/publish", method: "POST", apiLayer: "C", planned: false },
  workflowsDelete: { id: "workflows.delete", path: "/v1/workflows/:workflowId", method: "DELETE", apiLayer: "C", planned: false },
  workflowRunSteps: { id: "workflow-runs.steps", path: "/v1/workflow-runs/:workflowRunId/steps", method: "GET", apiLayer: "C", planned: false },
  approvals: { id: "approvals.list", path: "/v1/approvals", method: "GET", apiLayer: "C", planned: false },
  approvalsApprove: { id: "approvals.approve", path: "/v1/approvals/:approvalId/approve", method: "POST", apiLayer: "C", planned: false },
  approvalsReject: { id: "approvals.reject", path: "/v1/approvals/:approvalId/reject", method: "POST", apiLayer: "C", planned: false },
  approvalsDelegate: { id: "approvals.delegate", path: "/v1/approvals/:approvalId/delegate", method: "POST", apiLayer: "C", planned: false },
  approvalsRequestContext: { id: "approvals.request-context", path: "/v1/approvals/:approvalId/request-context", method: "POST", apiLayer: "C", planned: false },
  approvalsEdit: { id: "approvals.edit", path: "/v1/approvals/:approvalId/edit", method: "POST", apiLayer: "C", planned: false },
  approvalsEscalate: { id: "approvals.escalate", path: "/v1/approvals/:approvalId/escalate", method: "POST", apiLayer: "C", planned: false },
  approvalsDefer: { id: "approvals.defer", path: "/v1/approvals/:approvalId/defer", method: "POST", apiLayer: "C", planned: false },
  approvalsTextInput: { id: "approvals.text-input", path: "/v1/approvals/:approvalId/text-input", method: "POST", apiLayer: "C", planned: false },
  incidents: { id: "incidents.list", path: "/v1/incidents", method: "GET", apiLayer: "C", planned: false },
  incidentsUpdate: { id: "incidents.update", path: "/v1/incidents/:incidentId", method: "PATCH", apiLayer: "C", planned: false },
  workers: { id: "workers.list", path: "/v1/workers", method: "GET", apiLayer: "C", planned: false },
  workersDrain: { id: "workers.drain", path: "/v1/admin/workers/drain", method: "POST", apiLayer: "C", planned: false },
  queues: { id: "queues.list", path: "/v1/queues", method: "GET", apiLayer: "C", planned: false },
  queuesRetryCleanup: { id: "queues.retry-cleanup", path: "/v1/admin/queues/retry-cleanup", method: "POST", apiLayer: "C", planned: false },
  agents: { id: "agents.list", path: "/v1/agents", method: "GET", apiLayer: "C", planned: false },
  analytics: { id: "analytics.metrics", path: "/v1/dashboard/metrics", method: "GET", apiLayer: "C", planned: false },
  costs: { id: "costs.report", path: "/v1/cost-reports", method: "GET", apiLayer: "C", planned: false },
  marketplace: { id: "marketplace.list", path: "/v1/marketplace", method: "GET", apiLayer: "C", planned: false },
  missions: { id: "missions.list", path: "/v1/missions", method: "GET", apiLayer: "C", planned: false },
  missionMembers: { id: "missions.members", path: "/v1/missions/:missionId/members", method: "GET", apiLayer: "C", planned: false },
  missionTasks: { id: "missions.tasks", path: "/v1/missions/:missionId/tasks", method: "GET", apiLayer: "C", planned: false },
  missionRuns: { id: "missions.runs", path: "/v1/missions/:missionId/runs", method: "GET", apiLayer: "C", planned: false },
  missionEvidence: { id: "missions.evidence", path: "/v1/missions/:missionId/evidence", method: "GET", apiLayer: "C", planned: false },
  missionKnowledge: { id: "missions.knowledge", path: "/v1/missions/:missionId/knowledge", method: "GET", apiLayer: "C", planned: false },
  missionLearning: { id: "missions.learning", path: "/v1/missions/:missionId/learning", method: "GET", apiLayer: "C", planned: false },
  missionBudget: { id: "missions.budget", path: "/v1/missions/:missionId/budget", method: "GET", apiLayer: "C", planned: false },
  knowledge: { id: "knowledge.list", path: "/v1/knowledge", method: "GET", apiLayer: "C", planned: false },
  packs: { id: "packs.list", path: "/v1/packs", method: "GET", apiLayer: "C", planned: false },
  packVersions: { id: "packs.versions", path: "/v1/packs/:packId/versions", method: "GET", apiLayer: "C", planned: false },
  plugins: { id: "plugins.list", path: "/v1/plugins", method: "GET", apiLayer: "C", planned: false },
  prompts: { id: "prompts.list", path: "/v1/prompts", method: "GET", apiLayer: "C", planned: false },
  explanations: { id: "explanations.list", path: "/v1/explanations", method: "GET", apiLayer: "C", planned: false },
  roles: { id: "admin.roles", path: "/v1/admin/roles", method: "GET", apiLayer: "C", planned: false },
  compliancePolicies: { id: "admin.compliance-policies", path: "/v1/admin/compliance/policies", method: "GET", apiLayer: "C", planned: false },
  compliancePoliciesUpdate: { id: "admin.compliance-policies.update", path: "/v1/admin/compliance/policies/:policyId", method: "PATCH", apiLayer: "C", planned: false },
  auditLogs: { id: "admin.audit-logs", path: "/v1/admin/audit-logs", method: "GET", apiLayer: "C", planned: false },
  complianceExceptionsList: { id: "admin.compliance-exceptions.list", path: "/v1/admin/compliance/exceptions", method: "GET", apiLayer: "C", planned: false },
  complianceExceptions: { id: "admin.compliance-exceptions", path: "/v1/admin/compliance/exceptions", method: "POST", apiLayer: "C", planned: false },
  complianceExceptionsApprove: { id: "admin.compliance-exceptions.approve", path: "/v1/admin/compliance/exceptions/:exceptionId/approve", method: "POST", apiLayer: "C", planned: false },
  complianceExceptionsReject: { id: "admin.compliance-exceptions.reject", path: "/v1/admin/compliance/exceptions/:exceptionId/reject", method: "POST", apiLayer: "C", planned: false },
  featureFlags: { id: "admin.feature-flags", path: "/v1/admin/feature-flags", method: "GET", apiLayer: "C", planned: false },
  models: { id: "admin.models", path: "/v1/admin/models", method: "GET", apiLayer: "C", planned: false },
  domainConfigs: { id: "admin.domains", path: "/v1/admin/domains", method: "GET", apiLayer: "C", planned: false },
  tenants: { id: "admin.tenants", path: "/v1/admin/tenants", method: "GET", apiLayer: "C", planned: false },
  users: { id: "admin.users", path: "/v1/admin/users", method: "GET", apiLayer: "C", planned: false },
  usersCreate: { id: "admin.users.create", path: "/v1/admin/users", method: "POST", apiLayer: "C", planned: false },
  usersUpdate: { id: "admin.users.update", path: "/v1/admin/users/:userId", method: "PUT", apiLayer: "C", planned: false },
  systemConfig: { id: "admin.system-config", path: "/v1/admin/system-config", method: "GET", apiLayer: "C", planned: false },
  webhooks: { id: "admin.webhooks", path: "/v1/webhooks", method: "GET", apiLayer: "C", planned: false },
  preferences: { id: "user.preferences", path: "/v1/preferences", method: "GET", apiLayer: "C", planned: false },
  workflowBuilder: { id: "workflow-builder", path: "/v1/workflows/builder", method: "GET", apiLayer: "C", planned: false },
  contractVersion: { id: "meta.contract-version", path: "/v1/meta/contract-version", method: "GET", apiLayer: "A", planned: false },
  divisionInventorySnapshot: { id: "admin.governance.division-inventory", path: "/v1/admin/governance/division-inventory", method: "GET", apiLayer: "C", planned: false },
  leadershipClaimsConsole: { id: "admin.governance.leadership-claims", path: "/v1/admin/governance/leadership-claims", method: "GET", apiLayer: "C", planned: false },
  leadershipClaimsReviewRequest: { id: "admin.governance.leadership-claims.review-request", path: "/v1/admin/governance/leadership-claims/review-requests", method: "POST", apiLayer: "C", planned: false },
  leadershipClaimsApproveReviewRequest: { id: "admin.governance.leadership-claims.review-request.approve", path: "/v1/admin/governance/leadership-claims/review-requests/:requestId/approve", method: "POST", apiLayer: "C", planned: false },
  leadershipClaimsRejectReviewRequest: { id: "admin.governance.leadership-claims.review-request.reject", path: "/v1/admin/governance/leadership-claims/review-requests/:requestId/reject", method: "POST", apiLayer: "C", planned: false },
  leadershipClaimsRevoke: { id: "admin.governance.leadership-claims.revoke", path: "/v1/admin/governance/leadership-claims/:claimId/revoke", method: "POST", apiLayer: "C", planned: false },
} satisfies EndpointCatalogDefinition;

function buildQueryString(params: ListQueryParams): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}

function resolvePath(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((resolved, [key, value]) => resolved.replace(`:${key}`, value), template);
}

function unwrapCollectionResponse<T>(
  response: readonly T[] | Record<string, unknown>,
  keys: readonly string[],
): readonly T[] {
  if (Array.isArray(response)) {
    return response;
  }
  const responseObject = response as Record<string, unknown>;

  for (const key of keys) {
    const value = responseObject[key];
    if (Array.isArray(value)) {
      return value as readonly T[];
    }
  }

  return [];
}

type RawDashboardSnapshot = {
  readonly queueDepth?: number | null;
  readonly activeAgents?: number | null;
  readonly errorRate?: number | null;
  readonly avgDurationMs?: number | null;
  readonly p50LatencyMs?: number | null;
  readonly p99LatencyMs?: number | null;
  readonly budgetUtilizationPercent?: number | null;
  readonly uptimePercent?: number | null;
  readonly pendingApprovals?: readonly unknown[];
  readonly health?: {
    readonly status?: string | null;
    readonly activeExecutions?: number | null;
    readonly queuedTasks?: number | null;
    readonly providerSuccessRate?: number | null;
    readonly findings?: readonly string[];
  } | null;
  readonly metrics?: {
    readonly taskMetrics?: {
      readonly successRate?: number | null;
    } | null;
    readonly attemptMetrics?: {
      readonly averageDurationMs?: number | null;
    } | null;
    readonly runtimeMetrics?: {
      readonly activeExecutions?: number | null;
    } | null;
  } | null;
} & Record<string, unknown>;

function normalizeDashboardSnapshot(response: DashboardSnapshotDTO | RawDashboardSnapshot): DashboardSnapshotDTO {
  const raw = response as RawDashboardSnapshot;
  if (
    typeof (response as DashboardSnapshotDTO).overallHealth === "string"
    && typeof (response as DashboardSnapshotDTO).queueDepth === "number"
    && typeof (response as DashboardSnapshotDTO).activeExecutions === "number"
    && typeof (response as DashboardSnapshotDTO).approvalBacklog === "number"
    && typeof (response as DashboardSnapshotDTO).alertSummary === "string"
  ) {
    return response as DashboardSnapshotDTO;
  }

  const health = raw.health ?? null;
  const findings = Array.isArray(health?.findings) ? health.findings.filter((item): item is string => typeof item === "string") : [];
  const metrics = raw.metrics ?? null;
  const taskSuccessRate = metrics?.taskMetrics?.successRate;
  const providerSuccessRate = health?.providerSuccessRate;
  const avgDurationMs = raw.avgDurationMs ?? metrics?.attemptMetrics?.averageDurationMs;

  return {
    overallHealth: health?.status ?? "unknown",
    queueDepth: raw.queueDepth ?? health?.queuedTasks ?? 0,
    activeExecutions: health?.activeExecutions ?? metrics?.runtimeMetrics?.activeExecutions ?? 0,
    approvalBacklog: Array.isArray(raw.pendingApprovals) ? raw.pendingApprovals.length : 0,
    alertSummary: findings.join("; "),
    ...(taskSuccessRate != null
      ? { successRate: taskSuccessRate * 100 }
      : providerSuccessRate != null
        ? { successRate: providerSuccessRate * 100 }
        : {}),
    ...(typeof avgDurationMs === "number" ? { avgDurationMs } : {}),
    ...(raw.activeAgents != null ? { activeAgents: raw.activeAgents } : {}),
    ...(raw.errorRate != null ? { errorRate: raw.errorRate } : {}),
    ...(raw.p50LatencyMs !== undefined ? { p50LatencyMs: raw.p50LatencyMs } : {}),
    ...(raw.p99LatencyMs !== undefined ? { p99LatencyMs: raw.p99LatencyMs } : {}),
    ...(raw.budgetUtilizationPercent !== undefined ? { budgetUtilizationPercent: raw.budgetUtilizationPercent } : {}),
    ...(raw.uptimePercent !== undefined ? { uptimePercent: raw.uptimePercent } : {}),
  };
}

export async function fetchDashboardSnapshot(client: RESTClient): Promise<DashboardSnapshotDTO> {
  const response = await client.get<DashboardSnapshotDTO | RawDashboardSnapshot>(endpointCatalog.dashboardSnapshot.path);
  return normalizeDashboardSnapshot(response);
}

export async function fetchHealthReport(client: RESTClient): Promise<HealthStatusReportDTO> {
  return client.get<HealthStatusReportDTO>(endpointCatalog.healthReport.path);
}

export async function fetchTasks(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly TaskDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly TaskLikeRecord[] | { tasks: readonly TaskLikeRecord[] }>(`${endpointCatalog.tasks.path}${queryString}`);
  return unwrapCollectionResponse(response, ["tasks"]).map((task) => normalizeTaskDto(task));
}

export async function createTask(client: RESTClient, body: CreateTaskInput): Promise<CreateTaskResponse> {
  const { domainId, divisionId, status: _status, ...rest } = body;
  return client.post<CreateTaskResponse>(endpointCatalog.tasksCreate.path, {
    ...rest,
    ...(divisionId != null ? { divisionId } : domainId != null ? { divisionId: domainId } : {}),
  });
}

export async function updateTask(client: RESTClient, taskId: string, body: Partial<TaskDTO>): Promise<{ ok: true; body?: unknown }> {
  const patchBody = {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.owner === "string" ? { owner: body.owner } : {}),
    ...(mapTaskPatchStatus((body as Record<string, unknown>).status) == null
      ? {}
      : { status: mapTaskPatchStatus((body as Record<string, unknown>).status) }),
    ...(typeof (body as Record<string, unknown>).priority === "string"
      ? { priority: (body as Record<string, unknown>).priority }
      : {}),
    ...(typeof (body as Record<string, unknown>).outputJson === "string"
      ? { outputJson: (body as Record<string, unknown>).outputJson }
      : {}),
  };
  return client.patch<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.tasksUpdate.path, { taskId }), patchBody);
}

export async function deleteTask(client: RESTClient, taskId: string): Promise<{ ok: true; body?: unknown }> {
  return client.delete<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.tasksDelete.path, { taskId }));
}

export async function fetchWorkflows(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly WorkflowDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly WorkflowLikeRecord[] | { workflows: readonly WorkflowLikeRecord[] }>(`${endpointCatalog.workflows.path}${queryString}`);
  return unwrapCollectionResponse(response, ["workflows"]).map((workflow) => normalizeWorkflowDto(workflow));
}

export async function createWorkflow(client: RESTClient, body: Partial<WorkflowDTO>): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(endpointCatalog.workflowsCreate.path, body);
}

export async function pauseWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsPause.path, { workflowId }), { action: "pause" });
}

export async function resumeWorkflow(
  client: RESTClient,
  workflowId: string,
  mode: "normal" | "replan" | "supervised" | "abort" = "normal",
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsResume.path, { workflowId }), { action: "resume", mode });
}

export async function recoverWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsRecover.path, { workflowId }), { action: "recover" });
}

export async function releaseWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsRelease.path, { workflowId }), { action: "release" });
}

export async function publishWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsPublish.path, { workflowId }), { action: "publish" });
}

export async function deleteWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.delete<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsDelete.path, { workflowId }));
}

export async function cancelWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return deleteWorkflow(client, workflowId);
}

export async function fetchWorkflowRunSteps(client: RESTClient, workflowRunId: string): Promise<readonly WorkflowRunStepDTO[]> {
  return client.get<readonly WorkflowRunStepDTO[]>(resolvePath(endpointCatalog.workflowRunSteps.path, { workflowRunId }));
}

export async function fetchApprovals(
  client: RESTClient,
  queryParams?: ListQueryParams,
  requestOptions?: RestRequestOptions,
): Promise<readonly ApprovalDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly ApprovalDTO[] | { approvals: readonly ApprovalDTO[] }>(
    `${endpointCatalog.approvals.path}${queryString}`,
    requestOptions,
  );
  return unwrapCollectionResponse(response, ["approvals"]);
}

export async function approveApproval(client: RESTClient, approvalId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsApprove.path, { approvalId }), { decision: "approved" });
}

export async function rejectApproval(client: RESTClient, approvalId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsReject.path, { approvalId }), { decision: "rejected" });
}

export async function delegateApproval(client: RESTClient, approvalId: string, delegateTo: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsDelegate.path, { approvalId }), { delegateTo });
}

export async function requestMoreContextApproval(client: RESTClient, approvalId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsRequestContext.path, { approvalId }), { action: "request_more_context" });
}

export async function editApproval(
  client: RESTClient,
  approvalId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsEdit.path, { approvalId }), patch);
}

export async function escalateApproval(
  client: RESTClient,
  approvalId: string,
  reason: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsEscalate.path, { approvalId }), { reason });
}

export async function deferApproval(
  client: RESTClient,
  approvalId: string,
  until: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsDefer.path, { approvalId }), { until });
}

export async function submitApprovalTextInput(
  client: RESTClient,
  approvalId: string,
  input: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsTextInput.path, { approvalId }), { input });
}

export async function fetchIncidents(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly IncidentDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly IncidentDTO[] | { incidents: readonly IncidentDTO[] }>(
    `${endpointCatalog.incidents.path}${queryString}`,
  );
  return unwrapCollectionResponse(response, ["incidents"]);
}

export async function updateIncident(
  client: RESTClient,
  incidentId: string,
  patch: UpdateIncidentInput,
): Promise<IncidentDTO> {
  return client.patch<IncidentDTO>(resolvePath(endpointCatalog.incidentsUpdate.path, { incidentId }), patch);
}

export async function fetchWorkers(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly WorkerDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly WorkerDTO[] | { workers: readonly WorkerDTO[] }>(`${endpointCatalog.workers.path}${queryString}`);
  return unwrapCollectionResponse(response, ["workers"]);
}

export async function drainWorkers(
  client: RESTClient,
): Promise<{ drainedWorkerIds: readonly string[]; drainedCount: number; totalWorkers: number; workers: readonly WorkerDTO[] }> {
  return client.post(endpointCatalog.workersDrain.path, {});
}

export async function fetchQueues(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly QueueDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly QueueDTO[] | { queues: readonly QueueDTO[] }>(`${endpointCatalog.queues.path}${queryString}`);
  return unwrapCollectionResponse(response, ["queues"]);
}

export async function cleanupRetryQueue(
  client: RESTClient,
): Promise<{ cleanedTaskIds: readonly string[]; invalidatedTicketIds: readonly string[]; cleanedCount: number; queues: readonly QueueDTO[]; total: number }> {
  return client.post(endpointCatalog.queuesRetryCleanup.path, {});
}

export async function fetchAgents(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly AgentDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly AgentDTO[]>(`${endpointCatalog.agents.path}${queryString}`);
}

export async function fetchAnalytics(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly AnalyticsMetricDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly AnalyticsMetricDTO[]>(`${endpointCatalog.analytics.path}${queryString}`);
}

export async function fetchCosts(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly CostReportDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly CostReportDTO[] | { costReports: readonly CostReportDTO[] }>(
    `${endpointCatalog.costs.path}${queryString}`,
  );
  return unwrapCollectionResponse(response, ["costReports"]);
}

export async function fetchMarketplace(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly MarketplacePackDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly MarketplacePackDTO[]>(`${endpointCatalog.marketplace.path}${queryString}`);
}

export async function fetchMissions(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly MissionDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly MissionDTO[] | { missions: readonly MissionDTO[] }>(`${endpointCatalog.missions.path}${queryString}`);
  return unwrapCollectionResponse(response, ["missions"]);
}

export async function fetchMissionMembers(client: RESTClient, missionId: string): Promise<readonly MissionMemberDTO[]> {
  const response = await client.get<readonly MissionMemberDTO[] | { members: readonly MissionMemberDTO[] }>(
    resolvePath(endpointCatalog.missionMembers.path, { missionId }),
  );
  return unwrapCollectionResponse(response, ["members"]);
}

export async function fetchMissionTasks(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]> {
  const response = await client.get<readonly MissionResourceDTO[] | { tasks: readonly MissionResourceDTO[] }>(
    resolvePath(endpointCatalog.missionTasks.path, { missionId }),
  );
  return unwrapCollectionResponse(response, ["tasks"]);
}

export async function fetchMissionRuns(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]> {
  const response = await client.get<readonly MissionResourceDTO[] | { runs: readonly MissionResourceDTO[] }>(
    resolvePath(endpointCatalog.missionRuns.path, { missionId }),
  );
  return unwrapCollectionResponse(response, ["runs"]);
}

export async function fetchMissionEvidence(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]> {
  const response = await client.get<readonly MissionResourceDTO[] | { evidence: readonly MissionResourceDTO[] }>(
    resolvePath(endpointCatalog.missionEvidence.path, { missionId }),
  );
  return unwrapCollectionResponse(response, ["evidence"]);
}

export async function fetchMissionKnowledge(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]> {
  const response = await client.get<readonly MissionResourceDTO[] | { knowledge: readonly MissionResourceDTO[] }>(
    resolvePath(endpointCatalog.missionKnowledge.path, { missionId }),
  );
  return unwrapCollectionResponse(response, ["knowledge"]);
}

export async function fetchMissionLearning(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]> {
  const response = await client.get<readonly MissionResourceDTO[] | { learning: readonly MissionResourceDTO[] }>(
    resolvePath(endpointCatalog.missionLearning.path, { missionId }),
  );
  return unwrapCollectionResponse(response, ["learning"]);
}

export async function fetchMissionBudget(client: RESTClient, missionId: string): Promise<MissionBudgetSummaryDTO> {
  const response = await client.get<MissionBudgetSummaryDTO | { budget: MissionBudgetSummaryDTO }>(
    resolvePath(endpointCatalog.missionBudget.path, { missionId }),
  );
  return "budget" in response ? response.budget : response;
}

export async function fetchKnowledge(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly KnowledgeItemDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly KnowledgeItemDTO[]>(`${endpointCatalog.knowledge.path}${queryString}`);
}

export async function fetchPacks(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly MarketplacePackDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly MarketplacePackDTO[]>(`${endpointCatalog.packs.path}${queryString}`);
}

export async function fetchPackVersions(client: RESTClient, packId: string): Promise<readonly PackVersionDTO[]> {
  return client.get<readonly PackVersionDTO[]>(resolvePath(endpointCatalog.packVersions.path, { packId }));
}

export async function fetchPlugins(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly PluginDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly PluginDTO[]>(`${endpointCatalog.plugins.path}${queryString}`);
}

export async function fetchPrompts(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly PromptDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly PromptDTO[]>(`${endpointCatalog.prompts.path}${queryString}`);
}

export async function fetchExplanations(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly ExplanationDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly ExplanationDTO[]>(`${endpointCatalog.explanations.path}${queryString}`);
}

export async function fetchRoles(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly RoleDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly RoleDTO[] | { roles: readonly RoleDTO[] }>(`${endpointCatalog.roles.path}${queryString}`);
  return unwrapCollectionResponse(response, ["roles"]);
}

export async function fetchCompliancePolicies(
  client: RESTClient,
): Promise<readonly { id: string; name: string; severity: string }[]> {
  return client.get<readonly { id: string; name: string; severity: string }[]>(endpointCatalog.compliancePolicies.path);
}

export async function updateCompliancePolicy(
  client: RESTClient,
  policyId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true; body?: unknown }> {
  return client.patch<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.compliancePoliciesUpdate.path, { policyId }), patch);
}

export async function fetchAuditLogs(
  client: RESTClient,
): Promise<readonly {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  outcome: string;
  metadata?: Record<string, unknown>;
}[]> {
  return client.get(endpointCatalog.auditLogs.path);
}

export async function fetchComplianceExceptions(
  client: RESTClient,
): Promise<readonly ComplianceExceptionVmDTO[]> {
  return client.get(endpointCatalog.complianceExceptionsList.path);
}

export async function submitException(
  client: RESTClient,
  reason: string,
  policyId: string,
): Promise<{ id: string }> {
  return client.post(endpointCatalog.complianceExceptions.path, { reason, policyId });
}

export async function approveException(
  client: RESTClient,
  exceptionId: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.post(resolvePath(endpointCatalog.complianceExceptionsApprove.path, { exceptionId }), { action: "approve" });
}

export async function rejectException(
  client: RESTClient,
  exceptionId: string,
  rationale: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.post(resolvePath(endpointCatalog.complianceExceptionsReject.path, { exceptionId }), { rationale });
}

export async function fetchFeatureFlags(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly FeatureFlagDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly FeatureFlagDTO[] | { featureFlags: readonly FeatureFlagDTO[] }>(
    `${endpointCatalog.featureFlags.path}${queryString}`,
  );
  return unwrapCollectionResponse(response, ["featureFlags", "flags"]);
}

export async function fetchModels(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly ModelConfigDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly ModelConfigDTO[] | { models: readonly ModelConfigDTO[] }>(
    `${endpointCatalog.models.path}${queryString}`,
  );
  return unwrapCollectionResponse(response, ["models"]);
}

export async function fetchDomainConfigs(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly DomainConfigDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly DomainConfigDTO[] | { domains: readonly DomainConfigDTO[] }>(
    `${endpointCatalog.domainConfigs.path}${queryString}`,
  );
  return unwrapCollectionResponse(response, ["domains", "domainConfigs"]);
}

export async function fetchTenants(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly TenantDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  const response = await client.get<readonly TenantDTO[] | { tenants: readonly TenantDTO[] }>(
    `${endpointCatalog.tenants.path}${queryString}`,
  );
  return unwrapCollectionResponse(response, ["tenants"]);
}

export async function fetchUsers(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly UserDTO[]> {
  const queryString = buildQueryString(queryParams ?? {});
  return client.get<readonly UserDTO[]>(`${endpointCatalog.users.path}${queryString}`);
}

export async function createUser(client: RESTClient, body: Partial<UserDTO>): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(endpointCatalog.usersCreate.path, body);
}

export async function updateUser(client: RESTClient, userId: string, body: Partial<UserDTO>): Promise<{ ok: true; body?: unknown }> {
  return client.put<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.usersUpdate.path, { userId }), body);
}

export async function fetchSystemConfig(client: RESTClient): Promise<SystemConfigDTO> {
  return client.get<SystemConfigDTO>(endpointCatalog.systemConfig.path);
}

export async function fetchWebhooks(client: RESTClient): Promise<readonly WebhookDTO[]> {
  const response = await client.get<readonly WebhookDTO[] | { webhooks: readonly WebhookDTO[] }>(endpointCatalog.webhooks.path);
  return unwrapCollectionResponse(response, ["webhooks"]);
}

export async function fetchPreferences(client: RESTClient): Promise<UserPreferenceDTO> {
  return client.get<UserPreferenceDTO>(endpointCatalog.preferences.path);
}

export async function updatePreferences(
  client: RESTClient,
  body: Partial<UserPreferenceDTO>,
  ifMatch?: string,
): Promise<UserPreferenceDTO> {
  const headers = new Headers();
  if (ifMatch != null && ifMatch.length > 0) {
    headers.set("If-Match", ifMatch);
  }
  return client.put<UserPreferenceDTO>(endpointCatalog.preferences.path, body, { headers });
}

export async function fetchContractVersion(client: RESTClient): Promise<{ contractVersion: string; minServerVersion?: string }> {
  return client.get<{ contractVersion: string; minServerVersion?: string }>(endpointCatalog.contractVersion.path);
}

export async function fetchLeadershipClaimsConsole(client: RESTClient): Promise<LeadershipClaimsConsoleDTO> {
  return client.get<LeadershipClaimsConsoleDTO>(endpointCatalog.leadershipClaimsConsole.path);
}

export async function fetchDivisionInventorySnapshot(client: RESTClient): Promise<DivisionInventorySnapshotDTO> {
  return client.get<DivisionInventorySnapshotDTO>(endpointCatalog.divisionInventorySnapshot.path);
}

export async function submitLeadershipClaimReviewRequest(
  client: RESTClient,
  body: {
    familyId: string;
    divisionId?: string;
    scenarioId?: string;
    requestedClaimLevel: string;
    requestedSurfaces: readonly string[];
    evidenceRefs: readonly string[];
    rationale: string;
  },
): Promise<{ reviewRequest: { requestId: string; familyId: string; requestedBy: string; status: string } }> {
  return client.post(endpointCatalog.leadershipClaimsReviewRequest.path, body);
}

export async function approveLeadershipClaimReviewRequest(
  client: RESTClient,
  requestId: string,
  body: { reasonCode: string; comment?: string },
): Promise<{ reviewRequest: { requestId: string; status: string; reviewedBy: string | null } }> {
  return client.post(resolvePath(endpointCatalog.leadershipClaimsApproveReviewRequest.path, { requestId }), body);
}

export async function rejectLeadershipClaimReviewRequest(
  client: RESTClient,
  requestId: string,
  body: { reasonCode: string; comment?: string },
): Promise<{ reviewRequest: { requestId: string; status: string; reviewedBy: string | null } }> {
  return client.post(resolvePath(endpointCatalog.leadershipClaimsRejectReviewRequest.path, { requestId }), body);
}

export async function revokeLeadershipClaim(
  client: RESTClient,
  claimId: string,
  body: { reasonCode: string; comment?: string; replacementRequired: boolean },
): Promise<{
  statusOverride: {
    claimId: string;
    status: string;
    reasonCode: string;
    revokedBy: string;
    revokedAt: string;
    replacementRequired: boolean;
  };
}> {
  return client.post(resolvePath(endpointCatalog.leadershipClaimsRevoke.path, { claimId }), body);
}
