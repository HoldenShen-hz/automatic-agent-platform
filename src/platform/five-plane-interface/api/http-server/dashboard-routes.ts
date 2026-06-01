/**
 * @fileoverview Dashboard Routes - Mission control dashboard endpoints.
 *
 * Routes:
 * - GET /v1/dashboard/snapshot
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, decodeOpaqueCursor, encodeOpaqueCursor, readCursor, readLimit, readStoredJsonRecord, requirePrincipal, assertGlobalTenantScopeSupported } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import { PlatformWorkbenchSnapshotService } from "../../../shared/ux/platform-workbench-snapshot-service.js";
import { BenchmarkInventoryService } from "../../../shared/stability/benchmark-inventory-service.js";
import { DeploymentInventoryService } from "../../../shared/stability/deployment-inventory-service.js";
import { ProjectionInventoryService } from "../../../five-plane-state-evidence/events/projection-inventory-service.js";
import { ComplianceProgramTemplateService } from "../../../compliance/compliance-program-template-service.js";
import { JudgeProviderRegistryService } from "../../../prompt-engine/eval/judge-provider-registry-service.js";
import { globalVersionRoutingMiddleware } from "../middleware/version-routing.js";

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

interface DashboardCursor {
  readonly approvalIndex: number;
  readonly taskBoardIndex: number;
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
      pathname: "/v1/workers",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "worker snapshots");
        const limit = readLimit(ctx.request, 50);
        return buildJsonResponse(ctx.requestId, 200, toWorkerDtos(deps.missionControlService.getStabilityPanel(limit).workers));
      },
    },
    {
      method: "GET",
      pathname: "/v1/queues",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "queue snapshots");
        const panel = deps.missionControlService.getStabilityPanel(readLimit(ctx.request, 50));
        return buildJsonResponse(ctx.requestId, 200, toQueueDtos(panel));
      },
    },
    {
      method: "GET",
      pathname: "/v1/agents",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "agent snapshots");
        const panel = deps.missionControlService.getStabilityPanel(readLimit(ctx.request, 50));
        return buildJsonResponse(ctx.requestId, 200, toAgentDtos(panel.workers));
      },
    },
    {
      method: "GET",
      pathname: "/v1/dashboard/metrics",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "dashboard metrics");
        return buildJsonResponse(ctx.requestId, 200, toAnalyticsDtos(deps.missionControlService.getSnapshot()));
      },
    },
    {
      method: "GET",
      pathname: "/v1/explanations",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "explanation summaries");
        const snapshot = deps.missionControlService.getSnapshot();
        return buildJsonResponse(ctx.requestId, 200, [
          {
            id: "system-health",
            title: "Platform health summary",
            summary: snapshot.health.findings.join("; ") || `Platform status: ${snapshot.health.status}`,
            evidenceCount: snapshot.health.findings.length,
          },
        ]);
      },
    },
    {
      method: "GET",
      pathname: "/v1/meta/contract-version",
      handler: (ctx) => buildJsonResponse(ctx.requestId, 200, {
        contractVersion: globalVersionRoutingMiddleware.getSupportedVersions()[0] ?? "2026-04-01",
        minServerVersion: globalVersionRoutingMiddleware.getSupportedVersions().at(-1) ?? "2026-01-01",
      }),
    },
    {
      method: "GET",
      pathname: "/v1/workbench/snapshot",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "platform workbench");
        const cursorStr = readCursor(ctx.request);
        const limit = readLimit(ctx.request, 25);
        const decodedCursor = cursorStr == null ? null : decodeOpaqueCursor<DashboardCursor>(cursorStr);
        const missionControl = deps.missionControlService.getSnapshot();
        const allApprovals = missionControl.pendingApprovals;
        const allTaskBoard = missionControl.taskBoard;
        const approvalStartIndex = decodedCursor?.approvalIndex ?? 0;
        const taskBoardStartIndex = decodedCursor?.taskBoardIndex ?? 0;
        const slicedApprovals = allApprovals.slice(approvalStartIndex, approvalStartIndex + Math.min(limit, 10));
        const slicedTaskBoard = allTaskBoard.slice(taskBoardStartIndex, taskBoardStartIndex + Math.min(limit, 5));
        const approvalHasMore = approvalStartIndex + Math.min(limit, 10) < allApprovals.length;
        const taskBoardHasMore = taskBoardStartIndex + Math.min(limit, 5) < allTaskBoard.length;
        const hasMore = approvalHasMore || taskBoardHasMore;
        const lastApprovalIdx = approvalStartIndex + slicedApprovals.length;
        const lastTaskBoardIdx = taskBoardStartIndex + slicedTaskBoard.length;
        const nextCursor = hasMore
          ? encodeOpaqueCursor({
              approvalIndex: lastApprovalIdx < allApprovals.length ? lastApprovalIdx : 0,
              taskBoardIndex: lastTaskBoardIdx < allTaskBoard.length ? lastTaskBoardIdx : 0,
            })
          : null;
        const workbench = platformWorkbenchSnapshotService.buildSnapshot({
          generatedAt: missionControl.generatedAt,
          dashboard: {
            attentionQueue: slicedApprovals.slice(0, 5).map((approval) => ({
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
            recentCompletions: slicedTaskBoard.filter((item) => item.taskStatus === "done").slice(0, 5),
            proactiveSuggestions: [],
            metricRegistry: [],
          },
          approvalQueue: slicedApprovals.slice(0, 10).map((approval) => ({
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
        const operatorActions = "operatorActions" in workbench && Array.isArray((workbench as { operatorActions?: unknown }).operatorActions)
          ? (workbench as { operatorActions: unknown[] }).operatorActions
          : [];
        const response: Record<string, unknown> = { ...workbench, operatorActions, workbench };
        if (nextCursor != null) {
          response.nextCursor = nextCursor;
        }
        return buildJsonResponse(ctx.requestId, 200, response);
      },
    },
  ];
}

function toWorkerDtos(workers: ReturnType<MissionControlService["getStabilityPanel"]>["workers"]) {
  return workers.map((worker) => ({
    id: worker.workerId,
    status: normalizeWorkerStatus(worker.status),
    queue: worker.queueAffinity ?? "default",
    heartbeatLagMs: Math.max(0, Date.now() - new Date(worker.lastHeartbeatAt).getTime()),
  }));
}

function toQueueDtos(panel: ReturnType<MissionControlService["getStabilityPanel"]>) {
  const queueMap = new Map<string, { ready: number; inFlight: number }>();
  for (const worker of panel.workers) {
    const queue = worker.queueAffinity ?? "default";
    const entry = queueMap.get(queue) ?? { ready: 0, inFlight: 0 };
    entry.inFlight += worker.runningExecutionCount;
    queueMap.set(queue, entry);
  }
  const queuedByQueue = new Map<string, number>();
  for (const task of panel.queuedTasks) {
    const queue = task.divisionId ?? "default";
    queuedByQueue.set(queue, (queuedByQueue.get(queue) ?? 0) + 1);
  }
  if (queueMap.size === 0 && queuedByQueue.size === 0) {
    queueMap.set("default", { ready: panel.queuedTaskCount, inFlight: 0 });
  }
  for (const [queue, ready] of queuedByQueue.entries()) {
    const entry = queueMap.get(queue) ?? { ready: 0, inFlight: 0 };
    entry.ready = ready;
    queueMap.set(queue, entry);
  }
  return [...queueMap.entries()].map(([id, entry]) => ({
    id,
    ready: entry.ready,
    inFlight: entry.inFlight,
    retries: 0,
    dlq: 0,
  }));
}

function toAgentDtos(workers: ReturnType<MissionControlService["getStabilityPanel"]>["workers"]) {
  return workers.map((worker) => ({
    id: worker.workerId,
    name: worker.workerId,
    domainId: worker.queueAffinity ?? "platform",
    status: normalizeAgentStatus(worker.status),
    load: worker.maxConcurrency > 0 ? Number((worker.runningExecutionCount / worker.maxConcurrency).toFixed(2)) : 0,
  }));
}

function toAnalyticsDtos(snapshot: ReturnType<MissionControlService["getSnapshot"]>) {
  return [
    {
      id: "queue-depth",
      label: "Queue depth",
      value: snapshot.queueDepth,
      trend: snapshot.queueDepth > 0 ? "up" : "flat",
      layer: "tasks",
      description: "Current queued task count.",
    },
    {
      id: "active-agents",
      label: "Active agents",
      value: snapshot.activeAgents,
      trend: snapshot.activeAgents > 0 ? "up" : "flat",
      layer: "agents",
      description: "Currently active execution agents.",
    },
    {
      id: "error-rate",
      label: "Error rate",
      value: Number(snapshot.errorRate.toFixed(4)),
      trend: snapshot.errorRate > 0 ? "up" : "flat",
      layer: "overview",
      description: "Current workflow error rate.",
    },
    {
      id: "uptime",
      label: "Uptime",
      value: Number(snapshot.uptimePercent.toFixed(2)),
      trend: snapshot.uptimePercent >= 99 ? "flat" : "down",
      layer: "overview",
      description: "Platform uptime percentage.",
    },
  ];
}

function normalizeWorkerStatus(status: string): "idle" | "busy" | "draining" {
  if (status === "idle" || status === "busy") {
    return status;
  }
  return "draining";
}

function normalizeAgentStatus(status: string): "healthy" | "degraded" | "offline" {
  if (status === "idle" || status === "busy") {
    return "healthy";
  }
  if (status === "offline" || status === "unavailable") {
    return "offline";
  }
  return "degraded";
}

const MAX_APPROVAL_REQUEST_JSON_BYTES = 64 * 1024;

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
  const parsed = readStoredJsonRecord(requestJson, {
    maxBytes: MAX_APPROVAL_REQUEST_JSON_BYTES,
    fallback: {},
  });
  const value = parsed[field];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
