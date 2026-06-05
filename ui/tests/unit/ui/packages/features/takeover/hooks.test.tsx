// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: {},
  mockSubscribe: vi.fn(() => () => undefined),
  mockFetchAdminTakeoverConsole: vi.fn(),
  mockOpenAdminTakeoverSession: vi.fn(async () => ({ taskId: "task-1", takeoverSessionId: "takeover-1", operatorActionId: "opact-open" })),
  mockAnnotateAdminTakeoverSession: vi.fn(async () => ({ taskId: "task-1", takeoverSessionId: "takeover-1", operatorActionId: "opact-note" })),
  mockResumeAdminTakeoverSession: vi.fn(async () => ({ taskId: "task-1", takeoverSessionId: "takeover-1", operatorActionId: "opact-resume", closedAt: "2026-06-05T00:03:00.000Z" })),
}));

const taskData = [
  {
    id: "task-1",
    title: "Critical release",
    status: "paused",
    domainId: "platform",
    currentStep: "workflow-run-1",
    owner: "primary-sre",
  },
] as const;

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
  useWsClient: () => ({ subscribe: mocks.mockSubscribe }),
  useTasksQuery: () => ({ data: taskData }),
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchAdminTakeoverConsole: mocks.mockFetchAdminTakeoverConsole,
  openAdminTakeoverSession: mocks.mockOpenAdminTakeoverSession,
  annotateAdminTakeoverSession: mocks.mockAnnotateAdminTakeoverSession,
  resumeAdminTakeoverSession: mocks.mockResumeAdminTakeoverSession,
}));

import { useTakeoverVm } from "../../../../../../packages/features/takeover/src/hooks";

function buildConsoleSnapshot(overrides: Partial<Awaited<ReturnType<typeof mocks.mockFetchAdminTakeoverConsole>>> = {}) {
  return {
    generatedAt: "2026-06-05T00:00:00.000Z",
    scope: {
      taskId: "task-1",
      divisionId: "platform",
      workspaceId: null,
      tenantId: null,
    },
    executionOwner: {
      executionId: "exec-1",
      agentId: "agent-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      leaseStatus: "active",
    },
    activeWorker: null,
    versions: {
      modelVersion: null,
      promptVersion: null,
      policyVersion: null,
    },
    latestPmfVerdict: null,
    billingAccounts: [],
    inspect: {
      task: {
        id: "task-1",
        status: "running",
        inputJson: "{\"owner\":\"platform-sre\"}",
      },
      stepOutputs: [
        {
          id: "step-1",
          stepId: "collect-inputs",
          summary: "Collect inputs",
          status: "succeeded",
          roleId: "agent-1",
          producedAt: "2026-06-05T00:01:00.000Z",
        },
      ],
      takeoverSessions: [
        {
          id: "takeover-1",
          operatorId: "platform-sre",
          status: "open",
          reasonCode: "operator.manual_takeover",
          startedAt: "2026-06-05T00:00:00.000Z",
          closedAt: null,
        },
      ],
      operatorActions: [
        {
          id: "opact-1",
          takeoverSessionId: "takeover-1",
          taskId: "task-1",
          operatorId: "platform-sre",
          actionType: "take_over_task",
          reasonCode: "operator.manual_takeover",
          actionPayloadJson: "{}",
          createdAt: "2026-06-05T00:00:00.000Z",
        },
      ],
    },
    timeline: { entries: [] },
    ...overrides,
  };
}

describe("useTakeoverVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFetchAdminTakeoverConsole.mockResolvedValue(buildConsoleSnapshot());
  });

  it("loads the backend takeover console for the current candidate task", async () => {
    const { result } = renderHook(() => useTakeoverVm());

    await waitFor(() => {
      expect(result.current.currentSnapshot?.taskId).toBe("task-1");
    });

    expect(mocks.mockFetchAdminTakeoverConsole).toHaveBeenCalledWith(mocks.mockClient, "task-1");
    expect(result.current.currentSnapshot?.owner).toBe("platform-sre");
    expect(result.current.currentSnapshot?.steps).toHaveLength(1);
    expect(result.current.ownershipHistory[0]?.action).toBe("take_over_task");
  });

  it("normalizes awaiting-decision takeover snapshots into paused UI status", async () => {
    mocks.mockFetchAdminTakeoverConsole.mockResolvedValue(buildConsoleSnapshot({
      inspect: {
        ...buildConsoleSnapshot().inspect,
        task: {
          ...buildConsoleSnapshot().inspect.task,
          status: "awaiting_decision",
        },
        stepOutputs: [],
      },
    }));

    const { result } = renderHook(() => useTakeoverVm());

    await waitFor(() => {
      expect(result.current.currentSnapshot?.status).toBe("paused");
    });

    expect(result.current.currentSnapshot?.steps[0]).toMatchObject({
      status: "pending",
    });
  });

  it("opens a real takeover session and reloads the backend console", async () => {
    mocks.mockFetchAdminTakeoverConsole
      .mockResolvedValueOnce(buildConsoleSnapshot({ inspect: { ...buildConsoleSnapshot().inspect, takeoverSessions: [], operatorActions: [] } }))
      .mockResolvedValueOnce(buildConsoleSnapshot());
    const { result } = renderHook(() => useTakeoverVm());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.claimOwnership("task-1", "platform-sre");
    });

    expect(mocks.mockOpenAdminTakeoverSession).toHaveBeenCalledWith(mocks.mockClient, "task-1", {
      reasonCode: "operator.manual_takeover",
    });
    expect(mocks.mockFetchAdminTakeoverConsole).toHaveBeenCalledTimes(2);
  });

  it("writes annotations and resume actions to the backend session audit", async () => {
    const afterAnnotation = buildConsoleSnapshot({
      inspect: {
        ...buildConsoleSnapshot().inspect,
        operatorActions: [
          {
            id: "opact-note",
            takeoverSessionId: "takeover-1",
            taskId: "task-1",
            operatorId: "platform-sre",
            actionType: "acknowledge_takeover",
            reasonCode: "operator.takeover_annotation",
            actionPayloadJson: "{\"note\":\"manual-note\",\"mode\":\"annotation\"}",
            createdAt: "2026-06-05T00:02:00.000Z",
          },
          ...buildConsoleSnapshot().inspect.operatorActions,
        ],
      },
    });
    const afterResume = buildConsoleSnapshot({
      inspect: {
        ...afterAnnotation.inspect,
        takeoverSessions: [
          {
            ...afterAnnotation.inspect.takeoverSessions[0],
            status: "closed",
            closedAt: "2026-06-05T00:03:00.000Z",
          },
        ],
        operatorActions: [
          {
            id: "opact-resume",
            takeoverSessionId: "takeover-1",
            taskId: "task-1",
            operatorId: "platform-sre",
            actionType: "acknowledge_takeover",
            reasonCode: "operator.resume_automatic_execution",
            actionPayloadJson: "{\"mode\":\"resume_automatic_execution\"}",
            createdAt: "2026-06-05T00:03:00.000Z",
          },
          ...afterAnnotation.inspect.operatorActions,
        ],
      },
    });
    mocks.mockFetchAdminTakeoverConsole
      .mockResolvedValueOnce(buildConsoleSnapshot())
      .mockResolvedValueOnce(afterAnnotation)
      .mockResolvedValueOnce(afterResume);

    const { result } = renderHook(() => useTakeoverVm());

    await waitFor(() => {
      expect(result.current.currentSnapshot?.taskId).toBe("task-1");
    });

    await act(async () => {
      await result.current.annotateCurrentSnapshot("manual-note", "platform-sre");
    });

    expect(mocks.mockAnnotateAdminTakeoverSession).toHaveBeenCalledWith(mocks.mockClient, "takeover-1", {
      reasonCode: "operator.takeover_annotation",
      note: "manual-note",
    });
    expect(result.current.ownershipHistory[0]?.action).toBe("annotate:manual-note");

    await act(async () => {
      await result.current.resumeAutomaticExecution("platform-sre");
    });

    expect(mocks.mockResumeAdminTakeoverSession).toHaveBeenCalledWith(mocks.mockClient, "takeover-1", {
      reasonCode: "operator.resume_automatic_execution",
    });
    expect(result.current.ownershipHistory[0]?.action).toBe("resume");
    expect(result.current.canResume).toBe(false);
  });
});
