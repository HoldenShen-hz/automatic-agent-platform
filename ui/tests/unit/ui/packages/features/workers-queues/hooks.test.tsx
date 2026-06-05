// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(async () => undefined),
  mockRefetchQueries: vi.fn(async () => undefined),
  mockDrainWorkers: vi.fn(async () => ({ drainedWorkerIds: ["worker-1"], drainedCount: 1, totalWorkers: 2, workers: [] })),
  mockCleanupRetryQueue: vi.fn(async () => ({ cleanedTaskIds: ["task-1"], invalidatedTicketIds: ["ticket-1"], cleanedCount: 1, queues: [], total: 0 })),
  restClient: { id: "rest-client" },
  workers: [
    { id: "worker-1", status: "busy", queue: "finance", heartbeatLagMs: 120 },
    { id: "worker-2", status: "draining", queue: "finance", heartbeatLagMs: 80 },
  ],
  queues: [
    { id: "finance", ready: 3, inFlight: 2, retries: 4, dlq: 1 },
    { id: "ops", ready: 1, inFlight: 0, retries: 0, dlq: 0 },
  ],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.mockInvalidateQueries,
    refetchQueries: mocks.mockRefetchQueries,
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  drainWorkers: mocks.mockDrainWorkers,
  cleanupRetryQueue: mocks.mockCleanupRetryQueue,
}));

vi.mock("@aa/shared-state", () => ({
  missionControlQueryKeys: {
    workers: ["workers"],
    queues: ["queues"],
  },
  useRestClient: () => mocks.restClient,
  useWorkersQuery: () => ({ data: mocks.workers }),
  useQueuesQuery: () => ({ data: mocks.queues }),
}));

import { useWorkersVm } from "../../../../../../packages/features/workers/src/hooks";
import { useQueuesVm } from "../../../../../../packages/features/queues/src/hooks";

describe("workers and queues hooks", () => {
  it("refreshes workers with invalidate plus active refetch", async () => {
    mocks.mockInvalidateQueries.mockClear();
    mocks.mockRefetchQueries.mockClear();
    const { result } = renderHook(() => useWorkersVm());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.metrics.map((metric) => metric.value)).toEqual([2, 1, 1, "120ms"]);
    expect(result.current.busyWorkerCount).toBe(1);
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["workers"] });
    expect(mocks.mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ["workers"], type: "active" });
  });

  it("refreshes queues with invalidate plus active refetch", async () => {
    mocks.mockInvalidateQueries.mockClear();
    mocks.mockRefetchQueries.mockClear();
    const { result } = renderHook(() => useQueuesVm());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.metrics.map((metric) => metric.value)).toEqual([4, 2, 4, 1]);
    expect(result.current.retryQueueDepth).toBe(4);
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["queues"] });
    expect(mocks.mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ["queues"], type: "active" });
  });

  it("drains busy workers through the real mutation hook and refreshes queries", async () => {
    mocks.mockInvalidateQueries.mockClear();
    mocks.mockRefetchQueries.mockClear();
    mocks.mockDrainWorkers.mockClear();
    const { result } = renderHook(() => useWorkersVm());

    await act(async () => {
      await result.current.drainBusyWorkers();
    });

    expect(mocks.mockDrainWorkers).toHaveBeenCalledWith(mocks.restClient);
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["workers"] });
    expect(mocks.mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ["workers"], type: "active" });
  });

  it("cleans the retry queue through the real mutation hook and refreshes queries", async () => {
    mocks.mockInvalidateQueries.mockClear();
    mocks.mockRefetchQueries.mockClear();
    mocks.mockCleanupRetryQueue.mockClear();
    const { result } = renderHook(() => useQueuesVm());

    await act(async () => {
      await result.current.cleanupRetryQueue();
    });

    expect(mocks.mockCleanupRetryQueue).toHaveBeenCalledWith(mocks.restClient);
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["queues"] });
    expect(mocks.mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ["queues"], type: "active" });
  });
});
