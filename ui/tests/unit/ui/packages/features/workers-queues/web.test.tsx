// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const workersVm = {
  metrics: [],
  busyWorkerCount: 1,
  refresh: vi.fn(async () => undefined),
  drainBusyWorkers: vi.fn(async () => undefined),
};

const queuesVm = {
  metrics: [],
  retryQueueDepth: 2,
  refresh: vi.fn(async () => undefined),
  cleanupRetryQueue: vi.fn(async () => undefined),
};

vi.mock("../../../../../../packages/features/workers/src/hooks", () => ({
  useWorkersVm: () => workersVm,
}));

vi.mock("../../../../../../packages/features/queues/src/hooks", () => ({
  useQueuesVm: () => queuesVm,
}));

import { WorkersWebView } from "../../../../../../packages/features/workers/src/web";
import { QueuesWebView } from "../../../../../../packages/features/queues/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("workers and queues web views", () => {
  it("wires the drain action to the worker mutation", () => {
    render(<WorkersWebView />);
    fireEvent.click(screen.getByRole("button", { name: "排空忙碌 Worker" }));
    expect(workersVm.drainBusyWorkers).toHaveBeenCalledTimes(1);
  });

  it("wires the retry cleanup action to the queue mutation", () => {
    render(<QueuesWebView />);
    fireEvent.click(screen.getByRole("button", { name: "清理重试队列" }));
    expect(queuesVm.cleanupRetryQueue).toHaveBeenCalledTimes(1);
  });
});
