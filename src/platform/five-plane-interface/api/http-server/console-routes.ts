/**
 * @fileoverview Console Routes - HTML mission-control dashboard endpoints.
 *
 * Routes:
 * - GET /console
 * - GET /console/tasks/:id
 * - GET /console/workflows
 * - GET /console/workflows/:id
 * - GET /console/approvals
 * - GET /console/stability
 * - GET /console/admin/tasks/:id
 * - GET /console/targets
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildHtmlResponse, requirePrincipal, assertGlobalTenantScopeSupported, assertTaskTenantAccess, validateTaskId } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { GatewayTargetDirectoryService } from "../../channel-gateway/gateway-target-directory-service.js";
import { WS_PATH } from "../../channel-gateway/websocket-bridge.js";
import { AppError } from "../../../contracts/errors.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export interface ConsoleRouteDeps {
  authService: ApiAuthService | null;
  missionControlService: MissionControlService;
  gatewayTargetDirectoryService: GatewayTargetDirectoryService | null;
}

export function createConsoleRoutes(deps: ConsoleRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/console",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "dashboard snapshots");
        return buildHtmlResponse(buildMissionControlHtml(deps.missionControlService.getSnapshot()));
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "console" || segments[1] !== "tasks" || segments.length !== 3) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[2], "Task route");
        const cockpit = deps.missionControlService.getTaskCockpit(
          taskId,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        assertTaskTenantAccess(principal, cockpit.snapshot.task.tenantId ?? null, "api.task_not_found", "Task not found.");
        return buildHtmlResponse(buildTaskCockpitHtml(cockpit));
      },
    },
    {
      method: "GET",
      pathname: "/console/workflows",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildHtmlResponse(
          buildWorkflowListHtml(
            deps.missionControlService.listWorkflowCockpits(
              25,
              principal.tenantId != null ? principal.tenantId : undefined,
            ),
          ),
        );
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "console" || segments[1] !== "workflows" || segments.length !== 3) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[2], "Workflow route");
        const cockpit = deps.missionControlService.getWorkflowCockpit(taskId);
        assertTaskTenantAccess(principal, cockpit.inspect.task.tenantId ?? null, "api.workflow_not_found", "Workflow not found.");
        return buildHtmlResponse(buildWorkflowCockpitHtml(cockpit));
      },
    },
    {
      method: "GET",
      pathname: "/console/approvals",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildHtmlResponse(
          buildApprovalCenterHtml(
            deps.missionControlService.listApprovalQueue(
              25,
              principal.tenantId != null ? principal.tenantId : undefined,
            ),
          ),
        );
      },
    },
    {
      method: "GET",
      pathname: "/console/stability",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "stability panels");
        return buildHtmlResponse(buildStabilityPanelHtml(deps.missionControlService.getStabilityPanel(25)));
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "console"
          || segments[1] !== "admin"
          || segments[2] !== "tasks"
          || segments.length !== 4
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin takeover consoles");
        const taskId = validateTaskId(segments[3], "Admin route");
        return buildHtmlResponse(buildAdminTakeoverHtml(deps.missionControlService.getAdminTakeoverConsole(taskId)));
      },
    },
    {
      method: "GET",
      pathname: "/console/targets",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const svc = deps.gatewayTargetDirectoryService;
        if (svc == null) {
          throw new ApiError(503, "api.gateway_targets_unavailable", "Gateway target directory is not configured.");
        }
        return buildHtmlResponse(buildGatewayTargetsHtml(svc.listTargets({ limit: 50 })));
      },
    },
  ];
}

function buildMissionControlHtml(snapshot: ReturnType<MissionControlService["getSnapshot"]>): string {
  const firstTaskId = snapshot.taskBoard[0]?.taskId ?? null;
  const taskItems = snapshot.taskBoard
    .map(
      (item) =>
        `<li><a href="/console/tasks/${encodeURIComponent(item.taskId)}">${escapeHtml(item.title)}</a> <strong>${escapeHtml(item.taskStatus)}</strong> <a href="/console/workflows/${encodeURIComponent(item.taskId)}">workflow</a> <a href="/console/admin/tasks/${encodeURIComponent(item.taskId)}">admin</a></li>`,
    )
    .join("");

  const approvalItems = snapshot.pendingApprovals
    .map((approval) => `<li>${escapeHtml(approval.id)} <strong>${escapeHtml(approval.status)}</strong></li>`)
    .join("");

  const perceptionItems = snapshot.productSignals.perceptionBriefs
    .map((brief) => `<li>${escapeHtml(brief.briefId)} (${brief.proposalCount} proposals)</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Automatic Agent Mission Control</title>
  </head>
  <body>
    <h1>Mission Control</h1>
    ${buildConsoleNav("mission")}
    <section>
      <h2>System Status</h2>
      <p>Status: <strong>${escapeHtml(snapshot.health.status)}</strong></p>
      <p>Queued Tasks: ${snapshot.health.queuedTasks}</p>
      <p>Active Executions: ${snapshot.health.activeExecutions}</p>
      <p><a href="/console/stability">Open Stability Panel</a></p>
    </section>
    <section>
      <h2>Task Cockpit</h2>
      <ul>${taskItems || "<li>No active tasks</li>"}</ul>
      <p>Realtime Stream: <code>${escapeHtml(WS_PATH)}</code> using <code>Sec-WebSocket-Protocol: &lt;token&gt;,taskId=&lt;taskId&gt;,lastEventId=&lt;eventId&gt;</code></p>
    </section>
    <section>
      <h2>Workflow Cockpit</h2>
      <p><a href="/console/workflows">Open workflow list</a></p>
      <p>${firstTaskId == null ? "No workflow selected" : `<a href="/console/workflows/${encodeURIComponent(firstTaskId)}">Open current workflow</a>`}</p>
    </section>
    <section>
      <h2>Approval Center</h2>
      <p><a href="/console/approvals">Open approval queue</a></p>
      <ul>${approvalItems || "<li>No pending approvals</li>"}</ul>
    </section>
    <section>
      <h2>Admin Takeover Console</h2>
      <p>${firstTaskId == null ? "No task available for takeover" : `<a href="/console/admin/tasks/${encodeURIComponent(firstTaskId)}">Open takeover console</a>`}</p>
    </section>
    <section>
      <h2>Gateway Targets</h2>
      <p><a href="/console/targets">Open target directory</a></p>
      <p>Visible Targets: ${snapshot.gatewayTargets.length}</p>
    </section>
    <section>
      <h2>Product Signals</h2>
      <p>Billing Accounts: ${snapshot.productSignals.billingAccounts.length}</p>
      <p>Latest PMF: ${escapeHtml(snapshot.productSignals.latestPmfReport?.verdict ?? "none")}</p>
      <ul>${perceptionItems || "<li>No intel briefs</li>"}</ul>
    </section>
  </body>
</html>`;
}

function buildTaskCockpitHtml(cockpit: ReturnType<MissionControlService["getTaskCockpit"]>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Task Cockpit</title>
  </head>
  <body>
    <h1>Task Cockpit</h1>
    ${buildConsoleNav("tasks")}
    <p>Task: <strong>${escapeHtml(cockpit.snapshot.task.title)}</strong></p>
    <p>Status: ${escapeHtml(cockpit.snapshot.task.status)}</p>
    <p>Current Step Index: ${cockpit.inspect.workflowState?.currentStepIndex ?? "n/a"}</p>
    <p>Pending Approvals: ${cockpit.inspect.approvals.filter((approval) => approval.status === "requested").length}</p>
    <p>Events: ${cockpit.snapshot.events.length}</p>
    <p>Artifacts: ${cockpit.snapshot.artifacts.length}</p>
    <p><a href="/console/workflows/${encodeURIComponent(cockpit.snapshot.task.id)}">Open Workflow Cockpit</a> <a href="/console/admin/tasks/${encodeURIComponent(cockpit.snapshot.task.id)}">Open Admin Takeover</a></p>
    <section>
      <h2>Timeline</h2>
      <ul>
        ${cockpit.timeline.entries
          .slice(0, 20)
          .map((entry) => `<li>${escapeHtml(entry.kind)} :: ${escapeHtml(entry.summary)}</li>`)
          .join("")}
      </ul>
    </section>
  </body>
</html>`;
}

function buildWorkflowListHtml(workflows: ReturnType<MissionControlService["listWorkflowCockpits"]>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Workflow Cockpit</title>
  </head>
  <body>
    <h1>Workflow Cockpit</h1>
    ${buildConsoleNav("workflows")}
    <ul>
      ${workflows
        .map(
          (workflow) =>
            `<li><a href="/console/workflows/${encodeURIComponent(workflow.taskId)}">${escapeHtml(workflow.workflowId)}</a> :: ${escapeHtml(workflow.workflowStatus)} :: task ${escapeHtml(workflow.taskId)} :: step ${workflow.currentStepIndex}</li>`,
        )
        .join("") || "<li>No workflows available</li>"}
    </ul>
  </body>
</html>`;
}

function buildWorkflowCockpitHtml(cockpit: ReturnType<MissionControlService["getWorkflowCockpit"]>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Workflow Cockpit</title>
  </head>
  <body>
    <h1>Workflow Cockpit</h1>
    ${buildConsoleNav("workflows")}
    <p>Workflow: <strong>${escapeHtml(cockpit.summary.workflowId)}</strong></p>
    <p>Task: <a href="/console/tasks/${encodeURIComponent(cockpit.summary.taskId)}">${escapeHtml(cockpit.summary.taskId)}</a></p>
    <p>Status: ${escapeHtml(cockpit.summary.workflowStatus)}</p>
    <p>Current Step Index: ${cockpit.summary.currentStepIndex}</p>
    <p>Retry Count: ${cockpit.summary.retryCount}</p>
    <p>Pending Approvals: ${cockpit.summary.pendingApprovalCount}</p>
    <p>Resumable From Step: ${escapeHtml(cockpit.summary.resumableFromStep ?? "n/a")}</p>
    <p>Recovery Recommendation: ${escapeHtml(cockpit.inspect.runtimeRecovery.candidates[0]?.suggestedAction ?? "none")}</p>
    <section>
      <h2>Timeline</h2>
      <ul>
        ${cockpit.timeline.entries
          .slice(0, 20)
          .map((entry) => `<li>${escapeHtml(entry.kind)} :: ${escapeHtml(entry.summary)}</li>`)
          .join("") || "<li>No timeline entries</li>"}
      </ul>
    </section>
  </body>
</html>`;
}

function buildApprovalCenterHtml(approvals: ReturnType<MissionControlService["listApprovalQueue"]>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Approval Center</title>
  </head>
  <body>
    <h1>Approval Center</h1>
    ${buildConsoleNav("approvals")}
    <ul>
      ${approvals
        .map((approval) => `<li>${escapeHtml(approval.id)} :: ${escapeHtml(approval.status)} :: ${escapeHtml(approval.taskId)}</li>`)
        .join("") || "<li>No pending approvals</li>"}
    </ul>
  </body>
</html>`;
}

function buildStabilityPanelHtml(panel: ReturnType<MissionControlService["getStabilityPanel"]>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Stability Panel</title>
  </head>
  <body>
    <h1>Stability Panel</h1>
    ${buildConsoleNav("stability")}
    <p>Status: <strong>${escapeHtml(panel.health.status)}</strong></p>
    <p>Queued Tasks: ${panel.health.queuedTasks}</p>
    <p>Active Executions: ${panel.health.activeExecutions}</p>
    <p>Approval Backlog: ${panel.pendingApprovals.length}</p>
    <p>Event Backlog: ${panel.health.tier1AckBacklog}</p>
    <p>Worker Count: ${panel.workers.length}</p>
    <section>
      <h2>Active Alerts</h2>
      <ul>${panel.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("") || "<li>No active findings</li>"}</ul>
    </section>
    <section>
      <h2>Blocked Tasks</h2>
      <ul>
        ${panel.blockedTasks
          .map((task) => `<li><a href="/console/tasks/${encodeURIComponent(task.taskId)}">${escapeHtml(task.taskId)}</a> :: ${escapeHtml(task.taskStatus)}</li>`)
          .join("") || "<li>No blocked tasks</li>"}
      </ul>
    </section>
    <section>
      <h2>Workers</h2>
      <ul>
        ${panel.workers
          .map((worker) => `<li>${escapeHtml(worker.workerId)} :: ${escapeHtml(worker.status)} :: slots ${worker.availableSlots}</li>`)
          .join("") || "<li>No workers registered</li>"}
      </ul>
    </section>
  </body>
</html>`;
}

function buildAdminTakeoverHtml(view: ReturnType<MissionControlService["getAdminTakeoverConsole"]>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Admin Takeover Console</title>
  </head>
  <body>
    <h1>Admin Takeover Console</h1>
    ${buildConsoleNav("admin")}
    <p>Task Scope: <strong>${escapeHtml(view.scope.taskId)}</strong></p>
    <p>Division: ${escapeHtml(view.scope.divisionId ?? "none")}</p>
    <p>Workspace: ${escapeHtml(view.scope.workspaceId ?? "none")}</p>
    <p>Tenant: ${escapeHtml(view.scope.tenantId ?? "none")}</p>
    <p>Execution Owner: ${escapeHtml(view.executionOwner.executionId ?? "none")}</p>
    <p>Worker: ${escapeHtml(view.executionOwner.workerId ?? view.activeWorker?.workerId ?? "none")}</p>
    <p>Lease: ${escapeHtml(view.executionOwner.leaseId ?? "none")} (${escapeHtml(view.executionOwner.leaseStatus ?? "none")})</p>
    <p>Latest PMF Verdict: ${escapeHtml(view.latestPmfVerdict ?? "none")}</p>
    <section>
      <h2>Takeover Sessions</h2>
      <ul>
        ${view.inspect.takeoverSessions
          .map((session) => `<li>${escapeHtml(session.id)} :: ${escapeHtml(session.status)} :: ${escapeHtml(session.reasonCode)}</li>`)
          .join("") || "<li>No takeover sessions</li>"}
      </ul>
    </section>
    <section>
      <h2>Operator Actions</h2>
      <ul>
        ${view.inspect.operatorActions
          .map((action) => `<li>${escapeHtml(action.actionType)} :: ${escapeHtml(action.reasonCode)}</li>`)
          .join("") || "<li>No operator actions</li>"}
      </ul>
    </section>
    <section>
      <h2>Recent Timeline</h2>
      <ul>
        ${view.timeline.entries
          .slice(0, 15)
          .map((entry) => `<li>${escapeHtml(entry.kind)} :: ${escapeHtml(entry.summary)}</li>`)
          .join("") || "<li>No recent timeline</li>"}
      </ul>
    </section>
  </body>
</html>`;
}

function buildGatewayTargetsHtml(
  targets: ReturnType<GatewayTargetDirectoryService["listTargets"]>,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Gateway Targets</title>
  </head>
  <body>
    <h1>Gateway Targets</h1>
    ${buildConsoleNav("targets")}
    <ul>
      ${targets
        .map((target) => `<li>${escapeHtml(target.targetId)} :: ${escapeHtml(target.displayName)} :: ${escapeHtml(target.source)}</li>`)
        .join("") || "<li>No known targets</li>"}
    </ul>
  </body>
</html>`;
}

function buildConsoleNav(active: string): string {
  const items = [
    { key: "mission", label: "Mission Control", href: "/console" },
    { key: "tasks", label: "Task Cockpit", href: "/console" },
    { key: "workflows", label: "Workflow Cockpit", href: "/console/workflows" },
    { key: "approvals", label: "Approval Center", href: "/console/approvals" },
    { key: "stability", label: "Stability", href: "/console/stability" },
    { key: "targets", label: "Gateway Targets", href: "/console/targets" },
    { key: "admin", label: "Admin Takeover", href: "/console" },
  ];

  return `<nav><ul>${items
    .map((item) => `<li>${item.key === active ? "<strong>" : ""}<a href="${item.href}">${escapeHtml(item.label)}</a>${item.key === active ? "</strong>" : ""}</li>`)
    .join("")}</ul></nav>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
