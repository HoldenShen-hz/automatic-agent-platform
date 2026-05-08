import type {
  AgentDTO,
  AnalyticsMetricDTO,
  ApprovalDTO,
  CostReportDTO,
  DashboardSnapshotDTO,
  DomainConfigDTO,
  ExplanationDTO,
  FeatureFlagDTO,
  IncidentDTO,
  KnowledgeItemDTO,
  MarketplacePackDTO,
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
import type { RESTClient } from "./rest-client";

export interface EndpointDefinition {
  readonly id: string;
  readonly path: string;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly apiLayer: "A" | "B" | "C";
  readonly planned: boolean;
}

export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly filter?: string;
}

export const endpointCatalog = {
  dashboardSnapshot: { id: "dashboard.snapshot", path: "/dashboard/snapshot", method: "GET", apiLayer: "C", planned: false },
  tasks: { id: "tasks.list", path: "/tasks", method: "GET", apiLayer: "C", planned: false },
  tasksCreate: { id: "tasks.create", path: "/tasks", method: "POST", apiLayer: "C", planned: false },
  tasksUpdate: { id: "tasks.update", path: "/tasks/:taskId", method: "PUT", apiLayer: "C", planned: false },
  tasksDelete: { id: "tasks.delete", path: "/tasks/:taskId", method: "DELETE", apiLayer: "C", planned: false },
  workflows: { id: "workflows.list", path: "/workflows", method: "GET", apiLayer: "C", planned: false },
  workflowsCreate: { id: "workflows.create", path: "/workflows", method: "POST", apiLayer: "C", planned: false },
  workflowsPause: { id: "workflows.pause", path: "/workflows/:workflowId/pause", method: "POST", apiLayer: "C", planned: false },
  workflowsResume: { id: "workflows.resume", path: "/workflows/:workflowId/resume", method: "POST", apiLayer: "C", planned: false },
  workflowsPublish: { id: "workflows.publish", path: "/workflows/:workflowId/publish", method: "POST", apiLayer: "C", planned: false },
  workflowsDelete: { id: "workflows.delete", path: "/workflows/:workflowId", method: "DELETE", apiLayer: "C", planned: false },
  workflowRunSteps: { id: "workflow-runs.steps", path: "/workflow-runs/:workflowRunId/steps", method: "GET", apiLayer: "C", planned: false },
  approvals: { id: "approvals.list", path: "/approvals", method: "GET", apiLayer: "C", planned: false },
  approvalsApprove: { id: "approvals.approve", path: "/approvals/:approvalId/approve", method: "POST", apiLayer: "C", planned: false },
  approvalsReject: { id: "approvals.reject", path: "/approvals/:approvalId/reject", method: "POST", apiLayer: "C", planned: false },
  approvalsDelegate: { id: "approvals.delegate", path: "/approvals/:approvalId/delegate", method: "POST", apiLayer: "C", planned: false },
  incidents: { id: "incidents.list", path: "/incidents", method: "GET", apiLayer: "C", planned: false },
  incidentsUpdate: { id: "incidents.update", path: "/incidents/:incidentId", method: "PATCH", apiLayer: "C", planned: false },
  workers: { id: "workers.list", path: "/admin/workers", method: "GET", apiLayer: "B", planned: false },
  queues: { id: "queues.list", path: "/admin/queues", method: "GET", apiLayer: "B", planned: false },
  agents: { id: "agents.list", path: "/agents", method: "GET", apiLayer: "C", planned: false },
  analytics: { id: "analytics.metrics", path: "/dashboard/metrics", method: "GET", apiLayer: "C", planned: false },
  costs: { id: "costs.report", path: "/cost-reports", method: "GET", apiLayer: "C", planned: false },
  marketplace: { id: "marketplace.list", path: "/marketplace", method: "GET", apiLayer: "C", planned: false },
  knowledge: { id: "knowledge.list", path: "/knowledge", method: "GET", apiLayer: "C", planned: false },
  packs: { id: "packs.list", path: "/packs", method: "GET", apiLayer: "C", planned: false },
  packVersions: { id: "packs.versions", path: "/packs/:packId/versions", method: "GET", apiLayer: "C", planned: false },
  plugins: { id: "plugins.list", path: "/plugins", method: "GET", apiLayer: "C", planned: false },
  prompts: { id: "prompts.list", path: "/prompts", method: "GET", apiLayer: "C", planned: false },
  explanations: { id: "explanations.list", path: "/explanations", method: "GET", apiLayer: "C", planned: false },
  roles: { id: "admin.roles", path: "/admin/roles", method: "GET", apiLayer: "C", planned: false },
  featureFlags: { id: "admin.feature-flags", path: "/admin/feature-flags", method: "GET", apiLayer: "C", planned: false },
  models: { id: "admin.models", path: "/admin/models", method: "GET", apiLayer: "C", planned: false },
  domainConfigs: { id: "admin.domains", path: "/admin/domains", method: "GET", apiLayer: "C", planned: false },
  tenants: { id: "admin.tenants", path: "/admin/tenants", method: "GET", apiLayer: "C", planned: false },
  users: { id: "admin.users", path: "/admin/users", method: "GET", apiLayer: "C", planned: false },
  usersCreate: { id: "admin.users.create", path: "/admin/users", method: "POST", apiLayer: "C", planned: false },
  usersUpdate: { id: "admin.users.update", path: "/admin/users/:userId", method: "PUT", apiLayer: "C", planned: false },
  systemConfig: { id: "admin.system-config", path: "/admin/system-config", method: "GET", apiLayer: "C", planned: false },
  webhooks: { id: "admin.webhooks", path: "/webhooks", method: "GET", apiLayer: "C", planned: false },
  preferences: { id: "user.preferences", path: "/preferences", method: "GET", apiLayer: "C", planned: false },
  preferencesUpdate: { id: "user.preferences.update", path: "/preferences", method: "PATCH", apiLayer: "C", planned: false },
  workflowBuilder: { id: "workflow-builder", path: "/workflows/builder", method: "GET", apiLayer: "C", planned: false },
  // §1.8 contract version negotiation
  contractVersion: { id: "meta.contract-version", path: "/meta/contract-version", method: "GET", apiLayer: "A", planned: false },
} satisfies Record<string, EndpointDefinition>;

function resolvePath(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((resolved, [key, value]) => resolved.replace(`:${key}`, value), template);
}

function buildQueryString(pagination?: PaginationParams): string {
  if (pagination == null) return "";
  const params = new URLSearchParams();
  if (pagination.page != null) params.set("page", String(pagination.page));
  if (pagination.pageSize != null) params.set("pageSize", String(pagination.pageSize));
  if (pagination.sort != null) params.set("sort", pagination.sort);
  if (pagination.filter != null) params.set("filter", pagination.filter);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchDashboardSnapshot(client: RESTClient): Promise<DashboardSnapshotDTO> {
  return client.get<DashboardSnapshotDTO>(endpointCatalog.dashboardSnapshot.path);
}

export async function fetchTasks(client: RESTClient, pagination?: PaginationParams): Promise<readonly TaskDTO[]> {
  return client.get<readonly TaskDTO[]>(`${endpointCatalog.tasks.path}${buildQueryString(pagination)}`);
}

export async function createTask(client: RESTClient, body: Partial<TaskDTO>): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(endpointCatalog.tasksCreate.path, body);
}

export async function updateTask(client: RESTClient, taskId: string, body: Partial<TaskDTO>): Promise<{ ok: true; body?: unknown }> {
  return client.put<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.tasksUpdate.path, { taskId }), body);
}

export async function deleteTask(client: RESTClient, taskId: string): Promise<{ ok: true; body?: unknown }> {
  return client.delete<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.tasksDelete.path, { taskId }));
}

export async function fetchWorkflows(client: RESTClient, pagination?: PaginationParams): Promise<readonly WorkflowDTO[]> {
  return client.get<readonly WorkflowDTO[]>(`${endpointCatalog.workflows.path}${buildQueryString(pagination)}`);
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
  mode?: "normal" | "replan" | "supervised" | "abort",
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsResume.path, { workflowId }), {
    action: "resume",
    ...(mode == null ? {} : { mode }),
  });
}

export async function recoverWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsResume.path, { workflowId }), { action: "recover" });
}

export async function cancelWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsResume.path, { workflowId }), {
    action: "resume",
    mode: "abort",
  });
}

export async function releaseWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsPublish.path, { workflowId }), { action: "release" });
}

export async function publishWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsPublish.path, { workflowId }), { action: "publish" });
}

export async function deleteWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.delete<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsDelete.path, { workflowId }));
}

export async function fetchWorkflowRunSteps(client: RESTClient, workflowRunId: string): Promise<readonly WorkflowRunStepDTO[]> {
  return client.get<readonly WorkflowRunStepDTO[]>(resolvePath(endpointCatalog.workflowRunSteps.path, { workflowRunId }));
}

export async function fetchApprovals(client: RESTClient, pagination?: PaginationParams): Promise<readonly ApprovalDTO[]> {
  return client.get<readonly ApprovalDTO[]>(`${endpointCatalog.approvals.path}${buildQueryString(pagination)}`);
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

export async function submitApprovalTextInput(
  client: RESTClient,
  approvalId: string,
  inputText: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(
    `/approvals/${approvalId}/decision`,
    {
      decisionType: "text_input",
      inputText,
    },
  );
}

export async function submitApprovalAction(
  client: RESTClient,
  approvalId: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: true; body?: unknown }> {
  return submitApprovalTextInput(
    client,
    approvalId,
    JSON.stringify({ action, ...payload }),
  );
}

export async function editApproval(
  client: RESTClient,
  approvalId: string,
  edits: Record<string, unknown>,
): Promise<{ ok: true; body?: unknown }> {
  return submitApprovalAction(client, approvalId, "edit", { edits });
}

export async function escalateApproval(
  client: RESTClient,
  approvalId: string,
  reason: string,
): Promise<{ ok: true; body?: unknown }> {
  return submitApprovalAction(client, approvalId, "escalate", { reason });
}

export async function deferApproval(
  client: RESTClient,
  approvalId: string,
  until: string,
): Promise<{ ok: true; body?: unknown }> {
  return submitApprovalAction(client, approvalId, "defer", { until });
}

// §210-2493: requestMoreContextApproval not previously defined - add endpoint for requesting additional context
export async function requestMoreContextApproval(client: RESTClient, approvalId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.approvalsDelegate.path, { approvalId }), { action: "request_context" });
}

export async function fetchIncidents(client: RESTClient, pagination?: PaginationParams): Promise<readonly IncidentDTO[]> {
  return client.get<readonly IncidentDTO[]>(`${endpointCatalog.incidents.path}${buildQueryString(pagination)}`);
}

export async function updateIncident(
  client: RESTClient,
  incidentId: string,
  body: { status: "acknowledged" | "mitigating" | "resolved"; owner?: string },
): Promise<{ ok: true; body?: unknown }> {
  return client.patch<{ ok: true; body?: unknown }>(
    resolvePath(endpointCatalog.incidentsUpdate.path, { incidentId }),
    body,
  );
}

export async function acknowledgeIncident(
  client: RESTClient,
  incidentId: string,
  owner: string,
): Promise<{ ok: true; body?: unknown }> {
  return updateIncident(client, incidentId, { status: "acknowledged", owner });
}

export async function startIncidentMitigation(
  client: RESTClient,
  incidentId: string,
): Promise<{ ok: true; body?: unknown }> {
  return updateIncident(client, incidentId, { status: "mitigating" });
}

export async function resolveIncident(
  client: RESTClient,
  incidentId: string,
): Promise<{ ok: true; body?: unknown }> {
  return updateIncident(client, incidentId, { status: "resolved" });
}

export async function fetchWorkers(client: RESTClient): Promise<readonly WorkerDTO[]> {
  return client.get<readonly WorkerDTO[]>(endpointCatalog.workers.path);
}

export async function fetchQueues(client: RESTClient): Promise<readonly QueueDTO[]> {
  return client.get<readonly QueueDTO[]>(endpointCatalog.queues.path);
}

export async function fetchAgents(client: RESTClient, pagination?: PaginationParams): Promise<readonly AgentDTO[]> {
  return client.get<readonly AgentDTO[]>(`${endpointCatalog.agents.path}${buildQueryString(pagination)}`);
}

export async function fetchAnalytics(client: RESTClient, pagination?: PaginationParams): Promise<readonly AnalyticsMetricDTO[]> {
  return client.get<readonly AnalyticsMetricDTO[]>(`${endpointCatalog.analytics.path}${buildQueryString(pagination)}`);
}

export async function fetchCosts(client: RESTClient, pagination?: PaginationParams): Promise<readonly CostReportDTO[]> {
  return client.get<readonly CostReportDTO[]>(`${endpointCatalog.costs.path}${buildQueryString(pagination)}`);
}

export async function fetchMarketplace(client: RESTClient, pagination?: PaginationParams): Promise<readonly MarketplacePackDTO[]> {
  return client.get<readonly MarketplacePackDTO[]>(`${endpointCatalog.marketplace.path}${buildQueryString(pagination)}`);
}

export async function fetchKnowledge(client: RESTClient, pagination?: PaginationParams): Promise<readonly KnowledgeItemDTO[]> {
  return client.get<readonly KnowledgeItemDTO[]>(`${endpointCatalog.knowledge.path}${buildQueryString(pagination)}`);
}

export async function fetchPacks(client: RESTClient, pagination?: PaginationParams): Promise<readonly MarketplacePackDTO[]> {
  return client.get<readonly MarketplacePackDTO[]>(`${endpointCatalog.packs.path}${buildQueryString(pagination)}`);
}

export async function fetchPackVersions(client: RESTClient, packId: string): Promise<readonly PackVersionDTO[]> {
  return client.get<readonly PackVersionDTO[]>(resolvePath(endpointCatalog.packVersions.path, { packId }));
}

export async function fetchPlugins(client: RESTClient, pagination?: PaginationParams): Promise<readonly PluginDTO[]> {
  return client.get<readonly PluginDTO[]>(`${endpointCatalog.plugins.path}${buildQueryString(pagination)}`);
}

export async function fetchPrompts(client: RESTClient, pagination?: PaginationParams): Promise<readonly PromptDTO[]> {
  return client.get<readonly PromptDTO[]>(`${endpointCatalog.prompts.path}${buildQueryString(pagination)}`);
}

export async function fetchExplanations(client: RESTClient, pagination?: PaginationParams): Promise<readonly ExplanationDTO[]> {
  return client.get<readonly ExplanationDTO[]>(`${endpointCatalog.explanations.path}${buildQueryString(pagination)}`);
}

export async function fetchRoles(client: RESTClient, pagination?: PaginationParams): Promise<readonly RoleDTO[]> {
  return client.get<readonly RoleDTO[]>(`${endpointCatalog.roles.path}${buildQueryString(pagination)}`);
}

export async function fetchFeatureFlags(client: RESTClient, pagination?: PaginationParams): Promise<readonly FeatureFlagDTO[]> {
  return client.get<readonly FeatureFlagDTO[]>(`${endpointCatalog.featureFlags.path}${buildQueryString(pagination)}`);
}

export async function fetchModels(client: RESTClient, pagination?: PaginationParams): Promise<readonly ModelConfigDTO[]> {
  return client.get<readonly ModelConfigDTO[]>(`${endpointCatalog.models.path}${buildQueryString(pagination)}`);
}

export async function fetchDomainConfigs(client: RESTClient, pagination?: PaginationParams): Promise<readonly DomainConfigDTO[]> {
  return client.get<readonly DomainConfigDTO[]>(`${endpointCatalog.domainConfigs.path}${buildQueryString(pagination)}`);
}

export async function fetchTenants(client: RESTClient, pagination?: PaginationParams): Promise<readonly TenantDTO[]> {
  return client.get<readonly TenantDTO[]>(`${endpointCatalog.tenants.path}${buildQueryString(pagination)}`);
}

export async function fetchUsers(client: RESTClient, pagination?: PaginationParams): Promise<readonly UserDTO[]> {
  return client.get<readonly UserDTO[]>(`${endpointCatalog.users.path}${buildQueryString(pagination)}`);
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
  return client.get<readonly WebhookDTO[]>(endpointCatalog.webhooks.path);
}

export async function fetchPreferences(client: RESTClient): Promise<UserPreferenceDTO> {
  return client.get<UserPreferenceDTO>(endpointCatalog.preferences.path);
}

/**
 * Updates user preferences with optimistic locking per §4.7.8.
 * @param client - REST client
 * @param body - Preference updates
 * @param etag - Optional ETag for If-Match header (enables optimistic locking)
 */
export async function updatePreferences(
  client: RESTClient,
  body: Partial<UserPreferenceDTO>,
  etag?: string,
): Promise<{ ok: true; body?: unknown }> {
  return client.patch<{ ok: true; body?: unknown }>(
    endpointCatalog.preferencesUpdate.path,
    body,
    etag == null ? undefined : { "If-Match": etag },
  );
}

// §1.8 contract version negotiation
export interface ContractVersionInfo {
  readonly contractVersion: string;
  readonly minServerVersion: string;
  readonly supportedVersions: readonly string[];
}

export async function fetchContractVersion(client: RESTClient): Promise<ContractVersionInfo> {
  return client.get<ContractVersionInfo>(endpointCatalog.contractVersion.path);
}
