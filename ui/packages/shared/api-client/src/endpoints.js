export const endpointCatalog = {
    dashboardSnapshot: { id: "dashboard.snapshot", path: "/v1/dashboard/snapshot", method: "GET", apiLayer: "C", planned: false },
    tasks: { id: "tasks.list", path: "/v1/tasks", method: "GET", apiLayer: "C", planned: false },
    tasksCreate: { id: "tasks.create", path: "/v1/tasks", method: "POST", apiLayer: "C", planned: false },
    tasksUpdate: { id: "tasks.update", path: "/v1/tasks/:taskId", method: "PUT", apiLayer: "C", planned: false },
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
    workers: { id: "workers.list", path: "/v1/workers", method: "GET", apiLayer: "C", planned: false },
    queues: { id: "queues.list", path: "/v1/queues", method: "GET", apiLayer: "C", planned: false },
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
};
function buildQueryString(params) {
    const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
    if (entries.length === 0)
        return "";
    return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}
function resolvePath(template, params) {
    return Object.entries(params).reduce((resolved, [key, value]) => resolved.replace(`:${key}`, value), template);
}
function unwrapCollectionResponse(response, keys) {
    if (Array.isArray(response)) {
        return response;
    }
    const responseObject = response;
    for (const key of keys) {
        const value = responseObject[key];
        if (Array.isArray(value)) {
            return value;
        }
    }
    return [];
}
export async function fetchDashboardSnapshot(client) {
    return client.get(endpointCatalog.dashboardSnapshot.path);
}
export async function fetchTasks(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.tasks.path}${queryString}`);
    return unwrapCollectionResponse(response, ["tasks"]);
}
export async function createTask(client, body) {
    return client.post(endpointCatalog.tasksCreate.path, body);
}
export async function updateTask(client, taskId, body) {
    return client.put(resolvePath(endpointCatalog.tasksUpdate.path, { taskId }), body);
}
export async function deleteTask(client, taskId) {
    return client.delete(resolvePath(endpointCatalog.tasksDelete.path, { taskId }));
}
export async function fetchWorkflows(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.workflows.path}${queryString}`);
    return unwrapCollectionResponse(response, ["workflows"]);
}
export async function createWorkflow(client, body) {
    return client.post(endpointCatalog.workflowsCreate.path, body);
}
export async function pauseWorkflow(client, workflowId) {
    return client.post(resolvePath(endpointCatalog.workflowsPause.path, { workflowId }), { action: "pause" });
}
export async function resumeWorkflow(client, workflowId, mode = "normal") {
    return client.post(resolvePath(endpointCatalog.workflowsResume.path, { workflowId }), { action: "resume", mode });
}
export async function recoverWorkflow(client, workflowId) {
    return client.post(resolvePath(endpointCatalog.workflowsRecover.path, { workflowId }), { action: "recover" });
}
export async function releaseWorkflow(client, workflowId) {
    return client.post(resolvePath(endpointCatalog.workflowsRelease.path, { workflowId }), { action: "release" });
}
export async function publishWorkflow(client, workflowId) {
    return client.post(resolvePath(endpointCatalog.workflowsPublish.path, { workflowId }), { action: "publish" });
}
export async function deleteWorkflow(client, workflowId) {
    return client.delete(resolvePath(endpointCatalog.workflowsDelete.path, { workflowId }));
}
export async function cancelWorkflow(client, workflowId) {
    return deleteWorkflow(client, workflowId);
}
export async function fetchWorkflowRunSteps(client, workflowRunId) {
    return client.get(resolvePath(endpointCatalog.workflowRunSteps.path, { workflowRunId }));
}
export async function fetchApprovals(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.approvals.path}${queryString}`);
    return unwrapCollectionResponse(response, ["approvals"]);
}
export async function approveApproval(client, approvalId) {
    return client.post(resolvePath(endpointCatalog.approvalsApprove.path, { approvalId }), { decision: "approved" });
}
export async function rejectApproval(client, approvalId) {
    return client.post(resolvePath(endpointCatalog.approvalsReject.path, { approvalId }), { decision: "rejected" });
}
export async function delegateApproval(client, approvalId, delegateTo) {
    return client.post(resolvePath(endpointCatalog.approvalsDelegate.path, { approvalId }), { delegateTo });
}
export async function requestMoreContextApproval(client, approvalId) {
    return client.post(resolvePath(endpointCatalog.approvalsRequestContext.path, { approvalId }), { action: "request_more_context" });
}
export async function editApproval(client, approvalId, patch) {
    return client.post(resolvePath(endpointCatalog.approvalsEdit.path, { approvalId }), patch);
}
export async function escalateApproval(client, approvalId, reason) {
    return client.post(resolvePath(endpointCatalog.approvalsEscalate.path, { approvalId }), { reason });
}
export async function deferApproval(client, approvalId, until) {
    return client.post(resolvePath(endpointCatalog.approvalsDefer.path, { approvalId }), { until });
}
export async function submitApprovalTextInput(client, approvalId, input) {
    return client.post(resolvePath(endpointCatalog.approvalsTextInput.path, { approvalId }), { input });
}
export async function fetchIncidents(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.incidents.path}${queryString}`);
}
export async function fetchWorkers(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.workers.path}${queryString}`);
    return unwrapCollectionResponse(response, ["workers"]);
}
export async function fetchQueues(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.queues.path}${queryString}`);
    return unwrapCollectionResponse(response, ["queues"]);
}
export async function fetchAgents(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.agents.path}${queryString}`);
}
export async function fetchAnalytics(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.analytics.path}${queryString}`);
}
export async function fetchCosts(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.costs.path}${queryString}`);
}
export async function fetchMarketplace(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.marketplace.path}${queryString}`);
}
export async function fetchMissions(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.missions.path}${queryString}`);
    return unwrapCollectionResponse(response, ["missions"]);
}
export async function fetchMissionMembers(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionMembers.path, { missionId }));
    return unwrapCollectionResponse(response, ["members"]);
}
export async function fetchMissionTasks(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionTasks.path, { missionId }));
    return unwrapCollectionResponse(response, ["tasks"]);
}
export async function fetchMissionRuns(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionRuns.path, { missionId }));
    return unwrapCollectionResponse(response, ["runs"]);
}
export async function fetchMissionEvidence(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionEvidence.path, { missionId }));
    return unwrapCollectionResponse(response, ["evidence"]);
}
export async function fetchMissionKnowledge(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionKnowledge.path, { missionId }));
    return unwrapCollectionResponse(response, ["knowledge"]);
}
export async function fetchMissionLearning(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionLearning.path, { missionId }));
    return unwrapCollectionResponse(response, ["learning"]);
}
export async function fetchMissionBudget(client, missionId) {
    const response = await client.get(resolvePath(endpointCatalog.missionBudget.path, { missionId }));
    return "budget" in response ? response.budget : response;
}
export async function fetchKnowledge(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.knowledge.path}${queryString}`);
}
export async function fetchPacks(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.packs.path}${queryString}`);
}
export async function fetchPackVersions(client, packId) {
    return client.get(resolvePath(endpointCatalog.packVersions.path, { packId }));
}
export async function fetchPlugins(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.plugins.path}${queryString}`);
}
export async function fetchPrompts(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.prompts.path}${queryString}`);
}
export async function fetchExplanations(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.explanations.path}${queryString}`);
}
export async function fetchRoles(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.roles.path}${queryString}`);
}
export async function fetchCompliancePolicies(client) {
    return client.get(endpointCatalog.compliancePolicies.path);
}
export async function updateCompliancePolicy(client, policyId, patch) {
    return client.patch(resolvePath(endpointCatalog.compliancePoliciesUpdate.path, { policyId }), patch);
}
export async function fetchAuditLogs(client) {
    return client.get(endpointCatalog.auditLogs.path);
}
export async function submitException(client, reason, policyId) {
    return client.post(endpointCatalog.complianceExceptions.path, { reason, policyId });
}
export async function approveException(client, exceptionId) {
    return client.post(resolvePath(endpointCatalog.complianceExceptionsApprove.path, { exceptionId }), { action: "approve" });
}
export async function rejectException(client, exceptionId, rationale) {
    return client.post(resolvePath(endpointCatalog.complianceExceptionsReject.path, { exceptionId }), { rationale });
}
export async function fetchFeatureFlags(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.featureFlags.path}${queryString}`);
}
export async function fetchModels(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.models.path}${queryString}`);
}
export async function fetchDomainConfigs(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.domainConfigs.path}${queryString}`);
}
export async function fetchTenants(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.tenants.path}${queryString}`);
}
export async function fetchUsers(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    return client.get(`${endpointCatalog.users.path}${queryString}`);
}
export async function createUser(client, body) {
    return client.post(endpointCatalog.usersCreate.path, body);
}
export async function updateUser(client, userId, body) {
    return client.put(resolvePath(endpointCatalog.usersUpdate.path, { userId }), body);
}
export async function fetchSystemConfig(client) {
    return client.get(endpointCatalog.systemConfig.path);
}
export async function fetchWebhooks(client) {
    return client.get(endpointCatalog.webhooks.path);
}
export async function fetchPreferences(client) {
    return client.get(endpointCatalog.preferences.path);
}
export async function updatePreferences(client, body, ifMatch) {
    const headers = new Headers();
    if (ifMatch != null && ifMatch.length > 0) {
        headers.set("If-Match", ifMatch);
    }
    return client.put(endpointCatalog.preferences.path, body, { headers });
}
export async function fetchContractVersion(client) {
    return client.get(endpointCatalog.contractVersion.path);
}
