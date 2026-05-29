import type { AgentDTO, AnalyticsMetricDTO, ApprovalDTO, CostReportDTO, DashboardSnapshotDTO, DomainConfigDTO, ExplanationDTO, FeatureFlagDTO, IncidentDTO, KnowledgeItemDTO, MarketplacePackDTO, MissionBudgetSummaryDTO, MissionDTO, MissionMemberDTO, MissionResourceDTO, ModelConfigDTO, PackVersionDTO, PluginDTO, PromptDTO, QueueDTO, RoleDTO, SystemConfigDTO, TaskDTO, TenantDTO, UserDTO, UserPreferenceDTO, WebhookDTO, WorkerDTO, WorkflowRunStepDTO, WorkflowDTO } from "@aa/shared-types";
import type { RESTClient } from "./rest-client";
export interface ListQueryParams {
    readonly page?: number;
    readonly pageSize?: number;
    readonly sort?: string;
    readonly filter?: string;
}
export interface EndpointDefinition<TResponse = unknown, TRequestBody = never, TPathParams = never, TQueryParams = never> {
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
export type EndpointResponse<TEndpoint extends EndpointDefinition> = TEndpoint extends EndpointDefinition<infer TResponse, never, never, never> ? TResponse : TEndpoint extends EndpointDefinition<infer TResponse, unknown, unknown, unknown> ? TResponse : never;
export type EndpointRequestBody<TEndpoint extends EndpointDefinition> = TEndpoint extends EndpointDefinition<unknown, infer TRequestBody, unknown, unknown> ? TRequestBody : never;
export type EndpointPathParams<TEndpoint extends EndpointDefinition> = TEndpoint extends EndpointDefinition<unknown, unknown, infer TPathParams, unknown> ? TPathParams : never;
export type EndpointQueryParams<TEndpoint extends EndpointDefinition> = TEndpoint extends EndpointDefinition<unknown, unknown, unknown, infer TQueryParams> ? TQueryParams : never;
export declare const endpointCatalog: {
    dashboardSnapshot: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    tasks: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    tasksCreate: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    tasksUpdate: {
        id: string;
        path: string;
        method: "PUT";
        apiLayer: "C";
        planned: false;
    };
    tasksDelete: {
        id: string;
        path: string;
        method: "DELETE";
        apiLayer: "C";
        planned: false;
    };
    workflows: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    workflowsCreate: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    workflowsPause: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    workflowsResume: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    workflowsRecover: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    workflowsRelease: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    workflowsPublish: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    workflowsDelete: {
        id: string;
        path: string;
        method: "DELETE";
        apiLayer: "C";
        planned: false;
    };
    workflowRunSteps: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    approvals: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    approvalsApprove: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsReject: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsDelegate: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsRequestContext: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsEdit: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsEscalate: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsDefer: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    approvalsTextInput: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    incidents: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    workers: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    queues: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    agents: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    analytics: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    costs: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    marketplace: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missions: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionMembers: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionTasks: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionRuns: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionEvidence: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionKnowledge: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionLearning: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    missionBudget: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    knowledge: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    packs: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    packVersions: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    plugins: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    prompts: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    explanations: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    roles: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    compliancePolicies: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    compliancePoliciesUpdate: {
        id: string;
        path: string;
        method: "PATCH";
        apiLayer: "C";
        planned: false;
    };
    auditLogs: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    complianceExceptions: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    complianceExceptionsApprove: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    complianceExceptionsReject: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    featureFlags: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    models: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    domainConfigs: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    tenants: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    users: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    usersCreate: {
        id: string;
        path: string;
        method: "POST";
        apiLayer: "C";
        planned: false;
    };
    usersUpdate: {
        id: string;
        path: string;
        method: "PUT";
        apiLayer: "C";
        planned: false;
    };
    systemConfig: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    webhooks: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    preferences: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    workflowBuilder: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "C";
        planned: false;
    };
    contractVersion: {
        id: string;
        path: string;
        method: "GET";
        apiLayer: "A";
        planned: false;
    };
};
export declare function fetchDashboardSnapshot(client: RESTClient): Promise<DashboardSnapshotDTO>;
export declare function fetchTasks(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly TaskDTO[]>;
export declare function createTask(client: RESTClient, body: Partial<TaskDTO>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function updateTask(client: RESTClient, taskId: string, body: Partial<TaskDTO>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function deleteTask(client: RESTClient, taskId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function fetchWorkflows(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly WorkflowDTO[]>;
export declare function createWorkflow(client: RESTClient, body: Partial<WorkflowDTO>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function pauseWorkflow(client: RESTClient, workflowId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function resumeWorkflow(client: RESTClient, workflowId: string, mode?: "normal" | "replan" | "supervised" | "abort"): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function recoverWorkflow(client: RESTClient, workflowId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function releaseWorkflow(client: RESTClient, workflowId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function publishWorkflow(client: RESTClient, workflowId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function deleteWorkflow(client: RESTClient, workflowId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function cancelWorkflow(client: RESTClient, workflowId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function fetchWorkflowRunSteps(client: RESTClient, workflowRunId: string): Promise<readonly WorkflowRunStepDTO[]>;
export declare function fetchApprovals(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly ApprovalDTO[]>;
export declare function approveApproval(client: RESTClient, approvalId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function rejectApproval(client: RESTClient, approvalId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function delegateApproval(client: RESTClient, approvalId: string, delegateTo: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function requestMoreContextApproval(client: RESTClient, approvalId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function editApproval(client: RESTClient, approvalId: string, patch: Record<string, unknown>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function escalateApproval(client: RESTClient, approvalId: string, reason: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function deferApproval(client: RESTClient, approvalId: string, until: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function submitApprovalTextInput(client: RESTClient, approvalId: string, input: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function fetchIncidents(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly IncidentDTO[]>;
export declare function fetchWorkers(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly WorkerDTO[]>;
export declare function fetchQueues(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly QueueDTO[]>;
export declare function fetchAgents(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly AgentDTO[]>;
export declare function fetchAnalytics(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly AnalyticsMetricDTO[]>;
export declare function fetchCosts(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly CostReportDTO[]>;
export declare function fetchMarketplace(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly MarketplacePackDTO[]>;
export declare function fetchMissions(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly MissionDTO[]>;
export declare function fetchMissionMembers(client: RESTClient, missionId: string): Promise<readonly MissionMemberDTO[]>;
export declare function fetchMissionTasks(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]>;
export declare function fetchMissionRuns(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]>;
export declare function fetchMissionEvidence(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]>;
export declare function fetchMissionKnowledge(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]>;
export declare function fetchMissionLearning(client: RESTClient, missionId: string): Promise<readonly MissionResourceDTO[]>;
export declare function fetchMissionBudget(client: RESTClient, missionId: string): Promise<MissionBudgetSummaryDTO>;
export declare function fetchKnowledge(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly KnowledgeItemDTO[]>;
export declare function fetchPacks(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly MarketplacePackDTO[]>;
export declare function fetchPackVersions(client: RESTClient, packId: string): Promise<readonly PackVersionDTO[]>;
export declare function fetchPlugins(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly PluginDTO[]>;
export declare function fetchPrompts(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly PromptDTO[]>;
export declare function fetchExplanations(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly ExplanationDTO[]>;
export declare function fetchRoles(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly RoleDTO[]>;
export declare function fetchCompliancePolicies(client: RESTClient): Promise<readonly {
    id: string;
    name: string;
    severity: string;
}[]>;
export declare function updateCompliancePolicy(client: RESTClient, policyId: string, patch: Record<string, unknown>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function fetchAuditLogs(client: RESTClient): Promise<readonly {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    resource: string;
    outcome: string;
    metadata?: Record<string, unknown>;
}[]>;
export declare function submitException(client: RESTClient, reason: string, policyId: string): Promise<{
    id: string;
}>;
export declare function approveException(client: RESTClient, exceptionId: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function rejectException(client: RESTClient, exceptionId: string, rationale: string): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function fetchFeatureFlags(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly FeatureFlagDTO[]>;
export declare function fetchModels(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly ModelConfigDTO[]>;
export declare function fetchDomainConfigs(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly DomainConfigDTO[]>;
export declare function fetchTenants(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly TenantDTO[]>;
export declare function fetchUsers(client: RESTClient, queryParams?: ListQueryParams): Promise<readonly UserDTO[]>;
export declare function createUser(client: RESTClient, body: Partial<UserDTO>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function updateUser(client: RESTClient, userId: string, body: Partial<UserDTO>): Promise<{
    ok: true;
    body?: unknown;
}>;
export declare function fetchSystemConfig(client: RESTClient): Promise<SystemConfigDTO>;
export declare function fetchWebhooks(client: RESTClient): Promise<readonly WebhookDTO[]>;
export declare function fetchPreferences(client: RESTClient): Promise<UserPreferenceDTO>;
export declare function updatePreferences(client: RESTClient, body: Partial<UserPreferenceDTO>, ifMatch?: string): Promise<UserPreferenceDTO>;
export declare function fetchContractVersion(client: RESTClient): Promise<{
    contractVersion: string;
    minServerVersion?: string;
}>;
