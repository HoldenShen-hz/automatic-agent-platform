import { describe, expect, it } from "vitest";
import { getSharedTranslationService, resetSharedTranslationService } from "../../../../../../packages/shared/i18n/src";
import { mapDashboardSnapshotToVm } from "../../../../../../packages/features/dashboard/src/hooks";

describe("mapDashboardSnapshotToVm", () => {
  it("clamps ratio metrics, resolves analytics aliases, and normalizes trend values to percentages", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("zh-CN");

    const vm = mapDashboardSnapshotToVm(
      {
        overallHealth: "healthy",
        queueDepth: 20,
        activeExecutions: 10,
        approvalBacklog: 4,
        alertSummary: "stable",
        successRate: 97.2,
        avgDurationMs: 220,
        activeAgents: 2,
        errorRate: 4.5,
        p50LatencyMs: 120,
        p99LatencyMs: 480,
        budgetUtilizationPercent: 45,
        uptimePercent: 99.9,
      },
      [
        { id: "approval-sla", label: "审批 SLA", value: "99.1%", trend: "up" },
        { id: "metric-2", label: "工作流完成率", value: "92%", trend: "up" },
        { id: "metric-3", label: "队列吞吐", value: "1.4k/h", trend: "flat" },
      ],
      [{ id: "incident-1", severity: "critical", title: "critical", summary: "summary", createdAt: "2026-05-01T00:00:00.000Z" }],
      [{ id: "worker-1", status: "draining", queue: "primary", heartbeatLagMs: 900 }],
      [{ id: "queue-1", ready: 6, inFlight: 4, retries: 2, dlq: 1 }],
      [
        { id: "agent-1", name: "alpha", domainId: "ops", status: "healthy", load: 1.4 },
        { id: "agent-2", name: "beta", domainId: "ops", status: "degraded", load: -0.3 },
      ],
    );

    const economics = vm.panelGroups.find((group) => group.id === "economics");
    expect(economics?.panels.find((panel) => panel.id === "avg-agent-load")?.value).toBe("55%");
    expect(economics?.panels.find((panel) => panel.id === "max-agent-load")?.value).toBe("100%");
    expect(economics?.panels.find((panel) => panel.id === "approval-sla")?.value).toBe("99.1%");
    expect(economics?.panels.find((panel) => panel.id === "workflow-completion")?.value).toBe("92%");
    expect(vm.panelGroups.find((group) => group.id === "execution")?.panels.find((panel) => panel.id === "throughput")?.value).toBe("1.4k/h");
    expect(vm.trendValues.every((value) => value >= 0 && value <= 100)).toBe(true);
  });

  it("keeps detail-derived panels in an unresolved state until supporting queries load", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("zh-CN");

    const vm = mapDashboardSnapshotToVm({
      overallHealth: "overloaded",
      queueDepth: 12,
      activeExecutions: 1,
      approvalBacklog: 0,
      alertSummary: "queued_tasks_overloaded",
      successRate: 90.2,
      avgDurationMs: 0,
      activeAgents: 1,
      errorRate: 0.1,
      p50LatencyMs: null,
      p99LatencyMs: null,
      budgetUtilizationPercent: null,
      uptimePercent: 7.2,
    });

    const reliability = vm.panelGroups.find((group) => group.id === "reliability");
    const economics = vm.panelGroups.find((group) => group.id === "economics");
    const execution = vm.panelGroups.find((group) => group.id === "execution");
    expect(reliability?.panels.find((panel) => panel.id === "incident-count")?.value).toBe("--");
    expect(reliability?.panels.find((panel) => panel.id === "degraded-agents")?.value).toBe("--");
    expect(economics?.panels.find((panel) => panel.id === "healthy-agent-ratio")?.value).toBe("--");
    expect(execution?.panels.find((panel) => panel.id === "queue-ready")?.value).toBe("--");
  });

  it("counts only active incidents and keeps offline worker lag visible", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("en-US");

    const vm = mapDashboardSnapshotToVm(
      {
        overallHealth: "overloaded",
        queueDepth: 11,
        activeExecutions: 1,
        approvalBacklog: 0,
        alertSummary: "stale_workers_detected",
        successRate: 89.13,
        avgDurationMs: 0,
        activeAgents: 0,
        errorRate: 8.33,
        p50LatencyMs: null,
        p99LatencyMs: null,
        budgetUtilizationPercent: null,
        uptimePercent: 11.58,
      },
      [],
      [
        { id: "incident-open", severity: "high", title: "open", summary: "open", createdAt: "2026-06-05T00:00:00.000Z", status: "open" },
        { id: "incident-mitigating", severity: "critical", title: "mitigating", summary: "mitigating", createdAt: "2026-06-05T00:00:00.000Z", status: "mitigating" },
        { id: "incident-resolved", severity: "critical", title: "resolved", summary: "resolved", createdAt: "2026-06-05T00:00:00.000Z", status: "resolved" },
        { id: "incident-closed", severity: "high", title: "closed", summary: "closed", createdAt: "2026-06-05T00:00:00.000Z", status: "closed" },
      ],
      [{ id: "worker-offline", status: "offline", queue: "default", heartbeatLagMs: 25548325 }],
      [{ id: "platform", ready: 11, inFlight: 1, retries: 0, dlq: 0 }],
      [{ id: "agent-1", name: "offline-agent", domainId: "default", status: "offline", load: 1 }],
    );

    const reliability = vm.panelGroups.find((group) => group.id === "reliability");
    expect(reliability?.panels.find((panel) => panel.id === "incident-count")?.value).toBe("2");
    expect(reliability?.panels.find((panel) => panel.id === "critical-incidents")?.value).toBe("1");
    expect(reliability?.panels.find((panel) => panel.id === "worker-lag")?.value).toBe("25548325 ms");
    expect(reliability?.panels.find((panel) => panel.id === "error-rate")?.value).toBe("8.3%");
    expect(vm.trendValues[3]).toBeCloseTo(91.67, 2);
  });

  it("excludes offline agents from load saturation panels", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("zh-CN");

    const vm = mapDashboardSnapshotToVm(
      {
        overallHealth: "overloaded",
        queueDepth: 12,
        activeExecutions: 1,
        approvalBacklog: 0,
        alertSummary: "stale_workers_detected",
        successRate: 90.2,
        avgDurationMs: 0,
        activeAgents: 1,
        errorRate: 0.1,
        p50LatencyMs: null,
        p99LatencyMs: null,
        budgetUtilizationPercent: null,
        uptimePercent: 7.2,
      },
      [],
      [],
      [{ id: "worker-1", status: "offline", queue: "default", heartbeatLagMs: 1000 }],
      [],
      [{ id: "agent-1", name: "offline-agent", domainId: "default", status: "offline", load: 1 }],
    );

    const economics = vm.panelGroups.find((group) => group.id === "economics");
    expect(economics?.panels.find((panel) => panel.id === "avg-agent-load")?.value).toBe("0%");
    expect(economics?.panels.find((panel) => panel.id === "max-agent-load")?.value).toBe("0%");
    expect(economics?.panels.find((panel) => panel.id === "healthy-agent-ratio")?.value).toBe("0%");
  });
});
