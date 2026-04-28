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
  workflowBuilder: { id: "workflow-builder", path: "/workflows/builder", method: "GET", apiLayer: "C", planned: false },
  // §1.8 contract version negotiation
  contractVersion: { id: "meta.contract-version", path: "/api/v1/meta/contract-version", method: "GET", apiLayer: "A", planned: false },
} satisfies Record<string, EndpointDefinition>;

function resolvePath(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((resolved, [key, value]) => resolved.replace(`:${key}`, value), template);
}

export async function fetchDashboardSnapshot(client: RESTClient): Promise<DashboardSnapshotDTO> {
  return client.get<DashboardSnapshotDTO>(endpointCatalog.dashboardSnapshot.path);
}

export async function fetchTasks(client: RESTClient): Promise<readonly TaskDTO[]> {
  return client.get<readonly TaskDTO[]>(endpointCatalog.tasks.path);
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

export async function fetchWorkflows(client: RESTClient): Promise<readonly WorkflowDTO[]> {
  return client.get<readonly WorkflowDTO[]>(endpointCatalog.workflows.path);
}

export async function createWorkflow(client: RESTClient, body: Partial<WorkflowDTO>): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(endpointCatalog.workflowsCreate.path, body);
}

export async function pauseWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsPause.path, { workflowId }), { action: "pause" });
}

export async function resumeWorkflow(client: RESTClient, workflowId: string): Promise<{ ok: true; body?: unknown }> {
  return client.post<{ ok: true; body?: unknown }>(resolvePath(endpointCatalog.workflowsResume.path, { workflowId }), { action: "resume" });
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

export async function fetchApprovals(client: RESTClient): Promise<readonly ApprovalDTO[]> {
  return client.get<readonly ApprovalDTO[]>(endpointCatalog.approvals.path);
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

export async function fetchIncidents(client: RESTClient): Promise<readonly IncidentDTO[]> {
  return client.get<readonly IncidentDTO[]>(endpointCatalog.incidents.path);
}

export async function fetchWorkers(client: RESTClient): Promise<readonly WorkerDTO[]> {
  return client.get<readonly WorkerDTO[]>(endpointCatalog.workers.path);
}

export async function fetchQueues(client: RESTClient): Promise<readonly QueueDTO[]> {
  return client.get<readonly QueueDTO[]>(endpointCatalog.queues.path);
}

export async function fetchAgents(client: RESTClient): Promise<readonly AgentDTO[]> {
  return client.get<readonly AgentDTO[]>(endpointCatalog.agents.path);
}

export async function fetchAnalytics(client: RESTClient): Promise<readonly AnalyticsMetricDTO[]> {
  return client.get<readonly AnalyticsMetricDTO[]>(endpointCatalog.analytics.path);
}

export async function fetchCosts(client: RESTClient): Promise<readonly CostReportDTO[]> {
  return client.get<readonly CostReportDTO[]>(endpointCatalog.costs.path);
}

export async function fetchMarketplace(client: RESTClient): Promise<readonly MarketplacePackDTO[]> {
  return client.get<readonly MarketplacePackDTO[]>(endpointCatalog.marketplace.path);
}

export async function fetchKnowledge(client: RESTClient): Promise<readonly KnowledgeItemDTO[]> {
  return client.get<readonly KnowledgeItemDTO[]>(endpointCatalog.knowledge.path);
}

export async function fetchPacks(client: RESTClient): Promise<readonly MarketplacePackDTO[]> {
  return client.get<readonly MarketplacePackDTO[]>(endpointCatalog.packs.path);
}

export async function fetchPackVersions(client: RESTClient, packId: string): Promise<readonly PackVersionDTO[]> {
  return client.get<readonly PackVersionDTO[]>(resolvePath(endpointCatalog.packVersions.path, { packId }));
}

export async function fetchPlugins(client: RESTClient): Promise<readonly PluginDTO[]> {
  return client.get<readonly PluginDTO[]>(endpointCatalog.plugins.path);
}

export async function fetchPrompts(client: RESTClient): Promise<readonly PromptDTO[]> {
  return client.get<readonly PromptDTO[]>(endpointCatalog.prompts.path);
}

export async function fetchExplanations(client: RESTClient): Promise<readonly ExplanationDTO[]> {
  return client.get<readonly ExplanationDTO[]>(endpointCatalog.explanations.path);
}

export async function fetchRoles(client: RESTClient): Promise<readonly RoleDTO[]> {
  return client.get<readonly RoleDTO[]>(endpointCatalog.roles.path);
}

export async function fetchFeatureFlags(client: RESTClient): Promise<readonly FeatureFlagDTO[]> {
  return client.get<readonly FeatureFlagDTO[]>(endpointCatalog.featureFlags.path);
}

export async function fetchModels(client: RESTClient): Promise<readonly ModelConfigDTO[]> {
  return client.get<readonly ModelConfigDTO[]>(endpointCatalog.models.path);
}

export async function fetchDomainConfigs(client: RESTClient): Promise<readonly DomainConfigDTO[]> {
  return client.get<readonly DomainConfigDTO[]>(endpointCatalog.domainConfigs.path);
}

export async function fetchTenants(client: RESTClient): Promise<readonly TenantDTO[]> {
  return client.get<readonly TenantDTO[]>(endpointCatalog.tenants.path);
}

export async function fetchUsers(client: RESTClient): Promise<readonly UserDTO[]> {
  return client.get<readonly UserDTO[]>(endpointCatalog.users.path);
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

// §1.8 contract version negotiation
export interface ContractVersionInfo {
  readonly contractVersion: string;
  readonly minServerVersion: string;
  readonly supportedVersions: readonly string[];
}

export async function fetchContractVersion(client: RESTClient): Promise<ContractVersionInfo> {
  return client.get<ContractVersionInfo>(endpointCatalog.contractVersion.path);
}
