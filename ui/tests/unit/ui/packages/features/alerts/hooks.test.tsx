import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockClient = {};
const mutationCalls: Array<{ path: string; payload: { id: string } }> = [];
const createMutation = (path: ({ id }: { id: string }) => string) => {
  const mutateAsync = vi.fn(async (payload: { id: string }) => {
    mutationCalls.push({ path: path(payload), payload });
  });
  return {
    status: "idle",
    mutate: vi.fn((payload: { id: string }) => {
      mutationCalls.push({ path: path(payload), payload });
    }),
    mutateAsync,
  };
};

vi.mock("@aa/shared-state", () => ({
  useAuthState: () => ({
    userId: "ops-user",
    permissions: ["platform_sre"],
  }),
  useRestClient: () => mockClient,
  useIncidentsQuery: () => ({
    data: [
      {
        id: "incident-1",
        severity: "critical",
        title: "Primary region outage",
        summary: "gateway errors",
        createdAt: "2026-05-07T08:00:00.000Z",
        domainId: "platform",
      },
    ],
  }),
  useMutation: ({ path }: { path: ({ id }: { id: string }) => string }) => createMutation(path),
  useWsClient: () => ({
    subscribe: () => () => undefined,
    onStatusChange: () => () => undefined,
  }),
}));

import { mapAlertsToVm, useAlertsVm } from "../../../../../../packages/features/alerts/src/hooks";

describe("useAlertsVm", () => {
  it("wires acknowledge, snooze, escalate, and dismiss actions to incident mutations", async () => {
    mutationCalls.length = 0;
    const { result } = renderHook(() => useAlertsVm());

    await act(async () => {
      await result.current.onAcknowledge("incident-1");
      await result.current.onSnooze("incident-1");
      await result.current.onEscalate("incident-1");
      await result.current.onDismiss("incident-1");
    });

    expect(mutationCalls).toEqual([
      { path: "/alerts/incident-1/acknowledge", payload: { id: "incident-1" } },
      { path: "/alerts/incident-1/snooze", payload: { id: "incident-1" } },
      { path: "/alerts/incident-1/escalate", payload: { id: "incident-1" } },
      { path: "/alerts/incident-1/dismiss", payload: { id: "incident-1" } },
    ]);
    expect(result.current.history.map((entry) => entry.title)).toEqual([
      "Dismissed · Primary region outage",
      "Escalated · Primary region outage",
      "Snoozed 30m · Primary region outage",
      "Acknowledged · Primary region outage",
    ]);
    expect(result.current.items).toHaveLength(0);
  });

  it("sorts incidents by severity and applies severity filters in the mapped vm", () => {
    const incidents = [
      {
        id: "incident-1",
        severity: "high",
        title: "Queue lag",
        summary: "lag detected",
        createdAt: "2026-05-08T08:00:00.000Z",
        domainId: "platform",
      },
      {
        id: "incident-2",
        severity: "critical",
        title: "Approval outage",
        summary: "approval blocked",
        createdAt: "2026-05-08T07:00:00.000Z",
        domainId: "governance",
      },
    ] as const;

    const allVm = mapAlertsToVm(
      incidents,
      { severity: "all", domain: "all", timeRange: "all" },
      [],
      "idle",
      0,
      {
        onAcknowledge: vi.fn(),
        onDismiss: vi.fn(),
        onEscalate: vi.fn(),
        onSnooze: vi.fn(),
        setFilters: vi.fn(),
      },
    );
    expect(allVm.items.map((item) => item.id)).toEqual(["incident-2", "incident-1"]);

    const filteredVm = mapAlertsToVm(
      incidents,
      { severity: "critical", domain: "all", timeRange: "all" },
      [],
      "idle",
      0,
      {
        onAcknowledge: vi.fn(),
        onDismiss: vi.fn(),
        onEscalate: vi.fn(),
        onSnooze: vi.fn(),
        setFilters: vi.fn(),
      },
    );
    expect(filteredVm.items.map((item) => item.id)).toEqual(["incident-2"]);
  });
});
