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
});
