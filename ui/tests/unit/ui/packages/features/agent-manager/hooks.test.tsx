// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let agentData = [
  { id: "agent-1", name: "offline-worker", domainId: "default", status: "offline", load: 1 },
  { id: "agent-2", name: "healthy-worker", domainId: "platform", status: "healthy", load: 0.25 },
];

vi.mock("@aa/shared-state", () => ({
  useAgentsQuery: () => ({
    data: agentData,
    isLoading: false,
  }),
}));

import { useAgentManagerVm } from "../../../../../../packages/features/agent-manager/src/hooks";

describe("useAgentManagerVm", () => {
  beforeEach(() => {
    agentData = [
      { id: "agent-1", name: "offline-worker", domainId: "default", status: "offline", load: 1 },
      { id: "agent-2", name: "healthy-worker", domainId: "platform", status: "healthy", load: 0.25 },
    ];
  });

  it("does not present offline agent load as a real-time percentage", async () => {
    const { result } = renderHook(() => useAgentManagerVm());

    await waitFor(() => {
      expect(result.current.listItems[0]).toEqual({
        id: "agent-1",
        title: "offline-worker · offline",
        subtitle: "default / load n/a",
      });
    });

    expect(result.current.detailRows).toContainEqual({ key: "Load", value: "n/a" });
  });
});
