/**
 * @fileoverview Dashboard Routes - Mission control dashboard endpoints.
 *
 * Routes:
 * - GET /v1/dashboard/snapshot
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, requirePrincipal, assertGlobalTenantScopeSupported } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import { PlatformWorkbenchSnapshotService } from "../../../shared/ux/platform-workbench-snapshot-service.js";
import { BenchmarkInventoryService } from "../../../shared/stability/benchmark-inventory-service.js";
import { DeploymentInventoryService } from "../../../shared/stability/deployment-inventory-service.js";
import { ProjectionInventoryService } from "../../../state-evidence/events/projection-inventory-service.js";
import { ComplianceProgramTemplateService } from "../../../compliance/compliance-program-template-service.js";
import { JudgeProviderRegistryService } from "../../../prompt-engine/eval/judge-provider-registry-service.js";

export interface DashboardRouteDeps {
  authService: ApiAuthService | null;
  missionControlService: MissionControlService;
  platformWorkbenchSnapshotService?: PlatformWorkbenchSnapshotService;
  benchmarkInventoryService?: BenchmarkInventoryService;
  deploymentInventoryService?: DeploymentInventoryService;
  projectionInventoryService?: ProjectionInventoryService;
  complianceProgramTemplateService?: ComplianceProgramTemplateService;
  judgeProviderRegistryService?: JudgeProviderRegistryService;
}

export function createDashboardRoutes(deps: DashboardRouteDeps): RouteDefinition[] {
  const platformWorkbenchSnapshotService =
    deps.platformWorkbenchSnapshotService ?? new PlatformWorkbenchSnapshotService();
  const benchmarkInventoryService = deps.benchmarkInventoryService ?? new BenchmarkInventoryService();
  const deploymentInventoryService = deps.deploymentInventoryService ?? new DeploymentInventoryService();
  const projectionInventoryService = deps.projectionInventoryService ?? new ProjectionInventoryService();
  const complianceProgramTemplateService =
    deps.complianceProgramTemplateService ?? new ComplianceProgramTemplateService();
  const judgeProviderRegistryService =
    deps.judgeProviderRegistryService ?? new JudgeProviderRegistryService();
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
        const workbench = platformWorkbenchSnapshotService.buildSnapshot({
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
            metricRegistry: [],
          },
          approvalQueue: missionControl.pendingApprovals.slice(0, 10).map((approval) => ({
            approvalId: approval.id,
            taskId: approval.taskId,
            riskLevel: parseApprovalRisk(approval.requestJson),
            title: parseApprovalTitle(approval.requestJson),
            status: approval.status,
          })),
          inventorySummary: {
            benchmarkCount: benchmarkInventoryService.listBenchmarks().length,
            projectionCount: projectionInventoryService.listProjectionInventory().length,
            deploymentCount: deploymentInventoryService.listDeployments().length,
            judgeCount: judgeProviderRegistryService.registerDefaults().length,
            complianceProgramCount: complianceProgramTemplateService.listTemplates().length,
          },
        });
        return buildJsonResponse(ctx.requestId, 200, workbench);
      },
    },
  ];
}

function parseApprovalTitle(requestJson: string): string {
  return readApprovalField(requestJson, "title", "Approval required");
}

function parseApprovalReason(requestJson: string): string {
  return readApprovalField(requestJson, "reason", "Pending human review.");
}

function parseApprovalRisk(requestJson: string): "low" | "medium" | "high" | "critical" {
  const value = readApprovalField(requestJson, "riskLevel", "medium");
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function toAttentionPriority(
  riskLevel: ReturnType<typeof parseApprovalRisk>,
): "low" | "normal" | "high" | "critical" {
  if (riskLevel === "medium") {
    return "normal";
  }
  return riskLevel;
}

function readApprovalField(requestJson: string, field: string, fallback: string): string {
  try {
    const parsed = JSON.parse(requestJson) as Record<string, unknown>;
    const value = parsed[field];
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}
