import { describe, expect, it } from "vitest";
import { getSharedTranslationService, resetSharedTranslationService } from "../../../../../../packages/shared/i18n/src";
import { mapStabilityToVm } from "../../../../../../packages/features/stability/src/hooks";

describe("mapStabilityToVm", () => {
  it("keeps summary metrics unresolved until supporting queries settle", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("zh-CN");

    const vm = mapStabilityToVm({
      overallHealth: "overloaded",
      queueDepth: 12,
      activeExecutions: 1,
      approvalBacklog: 0,
      alertSummary: "stale_workers_detected",
      successRate: 90.2,
      avgDurationMs: 0,
      activeAgents: 0,
      errorRate: 0.1,
      p50LatencyMs: null,
      p99LatencyMs: null,
      budgetUtilizationPercent: null,
      uptimePercent: 0.17,
    });

    expect(vm.metrics.map((metric) => metric.value)).toEqual(["--", "--", "--", "--"]);
    expect(vm.rows.find((row) => row.key.includes("发现"))?.value ?? vm.rows.at(-1)?.value).toBe("--");
    expect(vm.items).toEqual([]);
  });

  it("shows real zero values after empty queries resolve", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("zh-CN");

    const vm = mapStabilityToVm(
      {
        overallHealth: "overloaded",
        queueDepth: 12,
        activeExecutions: 1,
        approvalBacklog: 0,
        alertSummary: "stale_workers_detected",
        successRate: 90.2,
        avgDurationMs: 0,
        activeAgents: 0,
        errorRate: 0.1,
        p50LatencyMs: null,
        p99LatencyMs: null,
        budgetUtilizationPercent: null,
        uptimePercent: 0.17,
      },
      [],
      [],
      [],
      [],
    );

    expect(vm.metrics.map((metric) => metric.value)).toEqual([0, 0, 0, 0]);
    expect(vm.rows.at(-1)?.value).toBe("0");
  });

  it("prioritizes active incidents ahead of history and counts only active incidents in the summary", () => {
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("en-US");

    const vm = mapStabilityToVm(
      {
        overallHealth: "overloaded",
        queueDepth: 12,
        activeExecutions: 1,
        approvalBacklog: 0,
        alertSummary: "stale_workers_detected",
        successRate: 90.2,
        avgDurationMs: 0,
        activeAgents: 0,
        errorRate: 8.3,
        p50LatencyMs: null,
        p99LatencyMs: null,
        budgetUtilizationPercent: null,
        uptimePercent: 12.2,
      },
      [
        { id: "incident-closed", severity: "high", title: "Closed incident", summary: "closed", createdAt: "2026-06-05T16:20:36.494Z", status: "closed" },
        { id: "incident-open", severity: "high", title: "Open incident", summary: "open", createdAt: "2026-06-05T16:20:36.477Z", status: "open" },
        { id: "incident-mitigating", severity: "critical", title: "Mitigating incident", summary: "mitigating", createdAt: "2026-06-05T16:19:07.625Z", status: "mitigating" },
      ],
      [{ id: "worker-1", status: "offline", queue: "default", heartbeatLagMs: 1000 }],
      [{ id: "default", ready: 0, inFlight: 1, retries: 0, dlq: 0 }],
      [],
    );

    expect(vm.metrics[0]?.value).toBe(2);
    expect(vm.rows.at(-1)?.value).toBe("2");
    expect(vm.items[0]?.title).toContain("Open incident");
    expect(vm.items[1]?.title).toContain("Mitigating incident");
    expect(vm.items[2]?.title).toContain("Closed incident");
  });
});
