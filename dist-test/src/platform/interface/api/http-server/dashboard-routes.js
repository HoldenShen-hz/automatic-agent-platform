/**
 * @fileoverview Dashboard Routes - Mission control dashboard endpoints.
 *
 * Routes:
 * - GET /v1/dashboard/snapshot
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import { buildJsonResponse, requirePrincipal, assertGlobalTenantScopeSupported } from "./utils.js";
import { PlatformWorkbenchSnapshotService } from "../../../../interaction/ux/platform-workbench-snapshot-service.js";
import { BenchmarkInventoryService } from "../../../shared/stability/benchmark-inventory-service.js";
import { DeploymentInventoryService } from "../../../shared/stability/deployment-inventory-service.js";
import { ProjectionInventoryService } from "../../../state-evidence/events/projection-inventory-service.js";
import { ComplianceProgramTemplateService } from "../../../compliance/compliance-program-template-service.js";
import { JudgeProviderRegistryService } from "../../../prompt-engine/eval/judge-provider-registry-service.js";
export function createDashboardRoutes(deps) {
    return [
        {
            method: "GET",
            pathname: "/dashboard/snapshot",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                assertGlobalTenantScopeSupported(principal, "dashboard snapshots");
                return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getSnapshot());
            },
        },
        {
            method: "GET",
            pathname: "/v1/dashboard/snapshot",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                assertGlobalTenantScopeSupported(principal, "dashboard snapshots");
                return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getSnapshot());
            },
        },
        {
            method: "GET",
            pathname: "/v1/workbench/snapshot",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                assertGlobalTenantScopeSupported(principal, "platform workbench");
                const missionControl = deps.missionControlService.getSnapshot();
                const workbench = new PlatformWorkbenchSnapshotService().buildSnapshot({
                    generatedAt: missionControl.generatedAt,
                    dashboard: {
                        attentionQueue: missionControl.pendingApprovals.slice(0, 5).map((approval) => ({
                            itemType: "approval_needed",
                            priority: toAttentionPriority(parseApprovalRisk(approval.requestJson)),
                            title: parseApprovalTitle(approval.requestJson),
                            description: parseApprovalReason(approval.requestJson),
                            actionOptions: ["open_approval"],
                            createdAt: approval.createdAt,
                            domainId: "global",
                        })),
                        dailySummary: {
                            tasksCompleted: missionControl.taskBoard.filter((item) => item.taskStatus === "done").length,
                            tasksInProgress: missionControl.taskBoard.filter((item) => item.taskStatus === "in_progress").length,
                            tasksFailed: missionControl.taskBoard.filter((item) => item.taskStatus === "failed").length,
                            totalCostToday: "$0.00",
                            agentUptimePercent: missionControl.health.status === "ok" ? 99 : missionControl.health.status === "degraded" ? 95 : 85,
                            highlights: [
                                `${missionControl.taskBoard.length} task(s) visible in task board`,
                                `${missionControl.gatewayTargets.length} gateway target(s) available`,
                            ],
                            concerns: missionControl.health.findings.slice(0, 3),
                        },
                        agentHealthCards: [],
                        costBurn: { consumedUsd: 0, forecastUsd: 0 },
                        activeGoals: [],
                        recentCompletions: missionControl.taskBoard.filter((item) => item.taskStatus === "done").slice(0, 5),
                        proactiveSuggestions: [],
                    },
                    approvalQueue: missionControl.pendingApprovals.slice(0, 10).map((approval) => ({
                        approvalId: approval.id,
                        taskId: approval.taskId,
                        riskLevel: parseApprovalRisk(approval.requestJson),
                        title: parseApprovalTitle(approval.requestJson),
                        status: approval.status,
                    })),
                    inventorySummary: {
                        benchmarkCount: new BenchmarkInventoryService().listBenchmarks().length,
                        projectionCount: new ProjectionInventoryService().listProjectionInventory().length,
                        deploymentCount: new DeploymentInventoryService().listDeployments().length,
                        judgeCount: new JudgeProviderRegistryService().registerDefaults().length,
                        complianceProgramCount: new ComplianceProgramTemplateService().listTemplates().length,
                    },
                });
                return buildJsonResponse(ctx.requestId, 200, workbench);
            },
        },
    ];
}
function parseApprovalTitle(requestJson) {
    return readApprovalField(requestJson, "title", "Approval required");
}
function parseApprovalReason(requestJson) {
    return readApprovalField(requestJson, "reason", "Pending human review.");
}
function parseApprovalRisk(requestJson) {
    const value = readApprovalField(requestJson, "riskLevel", "medium");
    return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}
function toAttentionPriority(riskLevel) {
    if (riskLevel === "medium") {
        return "normal";
    }
    return riskLevel;
}
function readApprovalField(requestJson, field, fallback) {
    try {
        const parsed = JSON.parse(requestJson);
        const value = parsed[field];
        return typeof value === "string" && value.trim().length > 0 ? value : fallback;
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=dashboard-routes.js.map