function mapTaskStatus(status) {
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
            return "paused";
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
function normalizeTaskDto(task) {
    const currentStep = typeof task.currentStep === "string" && task.currentStep.length > 0
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
function mapWorkflowStatus(status) {
    switch (status) {
        case "completed":
        case "done":
            return "completed";
        case "failed":
            return "failed";
        case "cancelled":
            return "cancelled";
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
function normalizeWorkflowDto(workflow) {
    const currentStage = typeof workflow.currentStage === "string" && workflow.currentStage.length > 0
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
function mapTaskPatchStatus(status) {
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
    missionActivate: { id: "missions.activate", path: "/v1/missions/:missionId:activate", method: "POST", apiLayer: "C", planned: false },
    missionPause: { id: "missions.pause", path: "/v1/missions/:missionId:pause", method: "POST", apiLayer: "C", planned: false },
    missionResume: { id: "missions.resume", path: "/v1/missions/:missionId:resume", method: "POST", apiLayer: "C", planned: false },
    missionFreeze: { id: "missions.freeze", path: "/v1/missions/:missionId:freeze", method: "POST", apiLayer: "C", planned: false },
    missionUnfreeze: { id: "missions.unfreeze", path: "/v1/missions/:missionId:unfreeze", method: "POST", apiLayer: "C", planned: false },
    missionComplete: { id: "missions.complete", path: "/v1/missions/:missionId:complete", method: "POST", apiLayer: "C", planned: false },
    missionArchive: { id: "missions.archive", path: "/v1/missions/:missionId:archive", method: "POST", apiLayer: "C", planned: false },
    missionMembers: { id: "missions.members", path: "/v1/missions/:missionId/members", method: "GET", apiLayer: "C", planned: false },
    missionTasks: { id: "missions.tasks", path: "/v1/missions/:missionId/tasks", method: "GET", apiLayer: "C", planned: false },
    missionRuns: { id: "missions.runs", path: "/v1/missions/:missionId/runs", method: "GET", apiLayer: "C", planned: false },
    missionEvidence: { id: "missions.evidence", path: "/v1/missions/:missionId/evidence", method: "GET", apiLayer: "C", planned: false },
    missionKnowledge: { id: "missions.knowledge", path: "/v1/missions/:missionId/knowledge", method: "GET", apiLayer: "C", planned: false },
    missionLearning: { id: "missions.learning", path: "/v1/missions/:missionId/learning", method: "GET", apiLayer: "C", planned: false },
    missionBudget: { id: "missions.budget", path: "/v1/missions/:missionId/budget", method: "GET", apiLayer: "C", planned: false },
    knowledge: { id: "knowledge.list", path: "/v1/knowledge", method: "GET", apiLayer: "C", planned: false },
    packs: { id: "packs.list", path: "/v1/packs", method: "GET", apiLayer: "C", planned: false },
    packsCreate: { id: "packs.create", path: "/v1/packs", method: "POST", apiLayer: "C", planned: false },
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
    workflowBuilderDraft: { id: "workflow-builder.draft", path: "/v1/workflows/builder/:draftId", method: "GET", apiLayer: "C", planned: false },
    workflowBuilderCreate: { id: "workflow-builder.create", path: "/v1/workflows/builder", method: "POST", apiLayer: "C", planned: false },
    workflowBuilderUpdate: { id: "workflow-builder.update", path: "/v1/workflows/builder/:draftId", method: "PATCH", apiLayer: "C", planned: false },
    workflowBuilderDelete: { id: "workflow-builder.delete", path: "/v1/workflows/builder/:draftId", method: "DELETE", apiLayer: "C", planned: false },
    contractVersion: { id: "meta.contract-version", path: "/v1/meta/contract-version", method: "GET", apiLayer: "A", planned: false },
    divisionInventorySnapshot: { id: "admin.governance.division-inventory", path: "/v1/admin/governance/division-inventory", method: "GET", apiLayer: "C", planned: false },
    leadershipClaimsConsole: { id: "admin.governance.leadership-claims", path: "/v1/admin/governance/leadership-claims", method: "GET", apiLayer: "C", planned: false },
    adminTakeoverConsole: { id: "admin.takeover.console", path: "/v1/admin/tasks/:taskId", method: "GET", apiLayer: "C", planned: false },
    adminTakeoverOpenSession: { id: "admin.takeover.open", path: "/v1/admin/tasks/:taskId/takeover/open", method: "POST", apiLayer: "C", planned: false },
    adminTakeoverAnnotateSession: { id: "admin.takeover.annotate", path: "/v1/admin/takeover/sessions/:sessionId/annotations", method: "POST", apiLayer: "C", planned: false },
    adminTakeoverResumeSession: { id: "admin.takeover.resume", path: "/v1/admin/takeover/sessions/:sessionId/resume", method: "POST", apiLayer: "C", planned: false },
    leadershipClaimsReviewRequest: { id: "admin.governance.leadership-claims.review-request", path: "/v1/admin/governance/leadership-claims/review-requests", method: "POST", apiLayer: "C", planned: false },
    leadershipClaimsApproveReviewRequest: { id: "admin.governance.leadership-claims.review-request.approve", path: "/v1/admin/governance/leadership-claims/review-requests/:requestId/approve", method: "POST", apiLayer: "C", planned: false },
    leadershipClaimsRejectReviewRequest: { id: "admin.governance.leadership-claims.review-request.reject", path: "/v1/admin/governance/leadership-claims/review-requests/:requestId/reject", method: "POST", apiLayer: "C", planned: false },
    leadershipClaimsRevoke: { id: "admin.governance.leadership-claims.revoke", path: "/v1/admin/governance/leadership-claims/:claimId/revoke", method: "POST", apiLayer: "C", planned: false },
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
function normalizeDashboardSnapshot(response) {
    const raw = response;
    if (typeof response.overallHealth === "string"
        && typeof response.queueDepth === "number"
        && typeof response.activeExecutions === "number"
        && typeof response.approvalBacklog === "number"
        && typeof response.alertSummary === "string") {
        return response;
    }
    const health = raw.health ?? null;
    const findings = Array.isArray(health?.findings) ? health.findings.filter((item) => typeof item === "string") : [];
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
export async function fetchDashboardSnapshot(client) {
    const response = await client.get(endpointCatalog.dashboardSnapshot.path);
    return normalizeDashboardSnapshot(response);
}
export async function fetchHealthReport(client) {
    return client.get(endpointCatalog.healthReport.path);
}
export async function fetchTasks(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.tasks.path}${queryString}`);
    return unwrapCollectionResponse(response, ["tasks"]).map((task) => normalizeTaskDto(task));
}
export async function createTask(client, body) {
    const { domainId, divisionId, status: _status, ...rest } = body;
    return client.post(endpointCatalog.tasksCreate.path, {
        ...rest,
        ...(divisionId != null ? { divisionId } : domainId != null ? { divisionId: domainId } : {}),
    });
}
export async function updateTask(client, taskId, body) {
    const patchBody = {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.owner === "string" ? { owner: body.owner } : {}),
        ...(mapTaskPatchStatus(body.status) == null
            ? {}
            : { status: mapTaskPatchStatus(body.status) }),
        ...(typeof body.priority === "string"
            ? { priority: body.priority }
            : {}),
        ...(typeof body.outputJson === "string"
            ? { outputJson: body.outputJson }
            : {}),
    };
    return client.patch(resolvePath(endpointCatalog.tasksUpdate.path, { taskId }), patchBody);
}
export async function deleteTask(client, taskId) {
    return client.delete(resolvePath(endpointCatalog.tasksDelete.path, { taskId }));
}
export async function fetchWorkflows(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.workflows.path}${queryString}`);
    return unwrapCollectionResponse(response, ["workflows"]).map((workflow) => normalizeWorkflowDto(workflow));
}
export async function createWorkflow(client, body) {
    return client.post(endpointCatalog.workflowsCreate.path, body);
}
export async function fetchWorkflowBuilderDrafts(client) {
    const response = await client.get(endpointCatalog.workflowBuilder.path);
    return response.drafts ?? [];
}
export async function fetchWorkflowBuilderDraft(client, draftId) {
    return client.get(resolvePath(endpointCatalog.workflowBuilderDraft.path, { draftId }));
}
export async function createWorkflowBuilderDraft(client, body, options) {
    return client.post(endpointCatalog.workflowBuilderCreate.path, body, options);
}
export async function updateWorkflowBuilderDraft(client, draftId, body, options) {
    return client.patch(resolvePath(endpointCatalog.workflowBuilderUpdate.path, { draftId }), body, options);
}
export async function deleteWorkflowBuilderDraft(client, draftId, options) {
    return client.delete(resolvePath(endpointCatalog.workflowBuilderDelete.path, { draftId }), options);
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
export async function fetchApprovals(client, queryParams, requestOptions) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.approvals.path}${queryString}`, requestOptions);
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
    const response = await client.get(`${endpointCatalog.incidents.path}${queryString}`);
    return unwrapCollectionResponse(response, ["incidents"]);
}
export async function updateIncident(client, incidentId, patch) {
    return client.patch(resolvePath(endpointCatalog.incidentsUpdate.path, { incidentId }), patch);
}
export async function fetchWorkers(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.workers.path}${queryString}`);
    return unwrapCollectionResponse(response, ["workers"]);
}
export async function drainWorkers(client) {
    return client.post(endpointCatalog.workersDrain.path, {});
}
export async function fetchQueues(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.queues.path}${queryString}`);
    return unwrapCollectionResponse(response, ["queues"]);
}
export async function cleanupRetryQueue(client) {
    return client.post(endpointCatalog.queuesRetryCleanup.path, {});
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
    const response = await client.get(`${endpointCatalog.costs.path}${queryString}`);
    return unwrapCollectionResponse(response, ["costReports"]).map((report) => normalizeCostReportDto(report));
}
function normalizeCostReportDto(report) {
    const periodStart = typeof report.periodStart === "string" ? report.periodStart : undefined;
    const periodEnd = typeof report.periodEnd === "string" ? report.periodEnd : undefined;
    const scope = typeof report.scope === "string" && report.scope.trim().length > 0
        ? report.scope
        : periodStart != null && periodEnd != null
            ? `${periodStart.slice(0, 10)} -> ${periodEnd.slice(0, 10)}`
            : typeof report.submittedBy === "string" && report.submittedBy.trim().length > 0
                ? report.submittedBy
                : "platform";
    const amountUsd = typeof report.amountUsd === "number" && Number.isFinite(report.amountUsd)
        ? report.amountUsd
        : typeof report.totalCostUsd === "number" && Number.isFinite(report.totalCostUsd)
            ? report.totalCostUsd
            : 0;
    return {
        id: typeof report.id === "string" && report.id.trim().length > 0
            ? report.id
            : typeof report.reportId === "string" && report.reportId.trim().length > 0
                ? report.reportId
                : `cost-report:${scope}:${periodEnd ?? "unknown"}`,
        scope,
        amountUsd,
        budgetUsd: typeof report.budgetUsd === "number" && Number.isFinite(report.budgetUsd) ? report.budgetUsd : null,
        ...(typeof report.currency === "string" ? { currency: report.currency } : {}),
        ...(periodStart == null ? {} : { periodStart }),
        ...(periodEnd == null ? {} : { periodEnd }),
        ...(typeof report.resourceCount === "number" ? { resourceCount: report.resourceCount } : {}),
        ...(typeof report.submittedBy === "string" ? { submittedBy: report.submittedBy } : {}),
    };
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
export async function activateMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionActivate.path, { missionId }), {});
}
export async function pauseMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionPause.path, { missionId }), {});
}
export async function resumeMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionResume.path, { missionId }), {});
}
export async function freezeMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionFreeze.path, { missionId }), {});
}
export async function unfreezeMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionUnfreeze.path, { missionId }), {});
}
export async function completeMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionComplete.path, { missionId }), {});
}
export async function archiveMission(client, missionId) {
    return client.post(resolvePath(endpointCatalog.missionArchive.path, { missionId }), {});
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
export async function createPack(client, body, options) {
    return client.post(endpointCatalog.packsCreate.path, body, options);
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
    const response = await client.get(`${endpointCatalog.roles.path}${queryString}`);
    return unwrapCollectionResponse(response, ["roles"]);
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
export async function fetchComplianceExceptions(client) {
    return client.get(endpointCatalog.complianceExceptionsList.path);
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
    const response = await client.get(`${endpointCatalog.featureFlags.path}${queryString}`);
    return unwrapCollectionResponse(response, ["featureFlags", "flags"]);
}
export async function fetchModels(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.models.path}${queryString}`);
    return unwrapCollectionResponse(response, ["models"]);
}
export async function fetchDomainConfigs(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.domainConfigs.path}${queryString}`);
    return unwrapCollectionResponse(response, ["domains", "domainConfigs"]);
}
export async function fetchTenants(client, queryParams) {
    const queryString = buildQueryString(queryParams ?? {});
    const response = await client.get(`${endpointCatalog.tenants.path}${queryString}`);
    return unwrapCollectionResponse(response, ["tenants"]);
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
    const response = await client.get(endpointCatalog.webhooks.path);
    return unwrapCollectionResponse(response, ["webhooks"]);
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
export async function fetchLeadershipClaimsConsole(client) {
    return client.get(endpointCatalog.leadershipClaimsConsole.path);
}
export async function fetchDivisionInventorySnapshot(client) {
    return client.get(endpointCatalog.divisionInventorySnapshot.path);
}
export async function fetchAdminTakeoverConsole(client, taskId) {
    return client.get(resolvePath(endpointCatalog.adminTakeoverConsole.path, { taskId }));
}
export async function openAdminTakeoverSession(client, taskId, body) {
    return client.post(resolvePath(endpointCatalog.adminTakeoverOpenSession.path, { taskId }), body);
}
export async function annotateAdminTakeoverSession(client, sessionId, body) {
    return client.post(resolvePath(endpointCatalog.adminTakeoverAnnotateSession.path, { sessionId }), body);
}
export async function resumeAdminTakeoverSession(client, sessionId, body) {
    return client.post(resolvePath(endpointCatalog.adminTakeoverResumeSession.path, { sessionId }), body);
}
export async function submitLeadershipClaimReviewRequest(client, body) {
    return client.post(endpointCatalog.leadershipClaimsReviewRequest.path, body);
}
export async function approveLeadershipClaimReviewRequest(client, requestId, body) {
    return client.post(resolvePath(endpointCatalog.leadershipClaimsApproveReviewRequest.path, { requestId }), body);
}
export async function rejectLeadershipClaimReviewRequest(client, requestId, body) {
    return client.post(resolvePath(endpointCatalog.leadershipClaimsRejectReviewRequest.path, { requestId }), body);
}
export async function revokeLeadershipClaim(client, claimId, body) {
    return client.post(resolvePath(endpointCatalog.leadershipClaimsRevoke.path, { claimId }), body);
}
