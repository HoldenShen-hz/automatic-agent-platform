// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDTO, WorkflowDTO } from "@aa/shared-types";

const mocks = vi.hoisted(() => ({
  client: { get: vi.fn() },
}));

let taskData: readonly TaskDTO[] = [];
let workflowData: readonly WorkflowDTO[] = [];

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.client,
  useTasksQuery: () => ({
    data: taskData,
    isLoading: false,
  }),
  useWorkflowsQuery: () => ({
    data: workflowData,
    isLoading: false,
  }),
}));

import { useDispatchVm } from "../../../../../../packages/features/dispatch/src/hooks";

describe("useDispatchVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskData = [
      {
        id: "task-1",
        title: "Dispatch live task",
        status: "running",
        domainId: "platform",
        currentStep: "real_model",
      },
    ] as const;
    workflowData = [
      {
        id: "task-1",
        title: "real_task_execution",
        status: "running",
        currentStage: "real_model",
        owner: "unknown",
        domainId: "platform",
        steps: [],
      },
    ] as const;
    mocks.client.get.mockResolvedValue({
      approvals: [],
      dispatchDecisions: [],
    });
  });

  it("renders workflow feed summaries from workflow domain when owner is not meaningful", async () => {
    const { result } = renderHook(() => useDispatchVm());

    await waitFor(() => {
      expect(result.current.workflowItems[0]).toEqual({
        title: "real_task_execution · running",
        description: "real_model · platform",
      });
    });
  });
});
