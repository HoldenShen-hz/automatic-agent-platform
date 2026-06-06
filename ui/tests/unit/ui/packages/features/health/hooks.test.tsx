// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: {},
  systemStatus: {
    wsStatus: "connected",
    offlineQueueSize: 2,
    syncStatus: "queued",
    panicActivated: false,
  },
  healthReport: {
    status: "degraded",
    uptimeSeconds: 321,
    dbWritable: true,
    providerHealth: "degraded",
    providerSuccessRate: 0.92,
    providerRecentCalls: 13,
    activeExecutions: 5,
    queuedTasks: 8,
    eventLoopLagMs: 17,
    memoryRssMb: 256,
    tier1AckBacklog: 3,
    degradationMode: "queue_only",
    backpressure: {
      status: "degraded",
      degradationMode: "queue_only",
      tier1AckBacklog: 3,
      queueGovernance: {
        backlogSize: 8,
        dispatchableBacklogSize: 6,
        claimedBacklogSize: 2,
        oldestWaitSeconds: 12,
        oldestClaimAgeSeconds: 4,
        queueNames: ["default"],
        starvationDetected: false,
      },
    },
    queueGovernance: {
      backlogSize: 8,
      dispatchableBacklogSize: 6,
      claimedBacklogSize: 2,
      oldestWaitSeconds: 12,
      oldestClaimAgeSeconds: 4,
      queueNames: ["default"],
      starvationDetected: false,
    },
    workerHealth: {
      totalWorkers: 4,
      healthyWorkers: 3,
      busyWorkers: 1,
      drainingWorkers: 0,
      degradedWorkers: 1,
      quarantinedWorkers: 0,
      offlineWorkers: 0,
      remoteWorkers: 2,
      remoteConnectedWorkers: 2,
      remoteReconnectingWorkers: 0,
      remoteDegradedSessions: 0,
      remoteFailedSessions: 0,
      remoteViewerOnlyWorkers: 0,
      remoteConsistencyMismatchWorkers: 0,
      remoteWorkspaceSyncConflictWorkers: 0,
      remoteOffsetMissingWorkers: 0,
      staleWorkers: 0,
      staleBusyWorkers: 0,
      loadSkewDetected: false,
      dominantWorkerId: null,
      dominantWorkerShare: null,
      skewedWorkerIds: [],
    },
    findings: ["provider_latency_high"],
  },
  fetchHealthReport: vi.fn(async () => mocks.healthReport),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useSystemStatus: () => mocks.systemStatus,
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchHealthReport: mocks.fetchHealthReport,
}));

import { useHealthVm } from "../../../../../../packages/features/health/src/hooks";

describe("useHealthVm", () => {
  it("loads the real backend health report and appends shell status rows", async () => {
    mocks.fetchHealthReport.mockClear();
    const { result } = renderHook(() => useHealthVm());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mocks.fetchHealthReport).toHaveBeenCalledWith(mocks.mockClient);
    expect(result.current.rows).toEqual(expect.arrayContaining([
      { key: "Data Source", value: "backend /health" },
      { key: "Overall Status", value: "degraded" },
      { key: "Provider Success", value: "92% (13 calls)" },
      { key: "Healthy Workers", value: "3/4" },
      { key: "Findings", value: "provider_latency_high" },
      { key: "Shell WS", value: "connected" },
      { key: "Shell Offline Queue", value: "2" },
      { key: "Shell Sync", value: "queued" },
    ]));
  });

  it("does not overstate provider success when there are no recent calls", async () => {
    mocks.fetchHealthReport.mockClear();
    mocks.fetchHealthReport.mockResolvedValueOnce({
      ...mocks.healthReport,
      providerSuccessRate: 1,
      providerRecentCalls: 0,
    });

    const { result } = renderHook(() => useHealthVm());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toEqual(expect.arrayContaining([
      { key: "Provider Success", value: "n/a (0 calls)" },
    ]));
  });

  it("refreshes by refetching backend health data", async () => {
    mocks.fetchHealthReport.mockClear();
    mocks.fetchHealthReport
      .mockResolvedValueOnce(mocks.healthReport)
      .mockResolvedValueOnce({
        ...mocks.healthReport,
        status: "ok",
        queuedTasks: 1,
        findings: [],
      });
    const { result } = renderHook(() => useHealthVm());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mocks.fetchHealthReport).toHaveBeenCalledTimes(2);
    expect(result.current.rows).toEqual(expect.arrayContaining([
      { key: "Overall Status", value: "ok" },
      { key: "Queued Tasks", value: "1" },
      { key: "Findings", value: "none" },
    ]));
  });
});
