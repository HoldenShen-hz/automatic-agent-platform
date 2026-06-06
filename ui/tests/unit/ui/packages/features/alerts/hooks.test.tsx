// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: {},
  mockInvalidateQueries: vi.fn(async () => undefined),
  mockRefetchQueries: vi.fn(async () => undefined),
  incidentData: [
    {
      id: "incident-1",
      severity: "critical",
      title: "Primary region outage",
      summary: "gateway errors",
      createdAt: "2026-05-07T08:00:00.000Z",
      status: "open",
    },
  ] as Array<Record<string, unknown>>,
  incidentSubscription: null as ((event: { type: string; payload: { incident?: Record<string, unknown> } }) => void) | null,
  mockUpdateIncident: vi.fn(async (_client, incidentId: string, patch: Record<string, unknown>) => ({
    id: incidentId,
    severity: "critical",
    title: "Primary region outage",
    summary: "gateway errors",
    createdAt: "2026-05-07T08:00:00.000Z",
    ...patch,
  })),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.mockInvalidateQueries,
    refetchQueries: mocks.mockRefetchQueries,
  }),
}));

vi.mock("@aa/shared-state", () => ({
  missionControlQueryKeys: {
    incidents: ["incidents"],
  },
  useAuthState: () => ({
    userId: "ops-user",
    permissions: ["platform_sre"],
  }),
  useRestClient: () => mocks.mockClient,
  useIncidentsQuery: () => ({
    data: mocks.incidentData,
  }),
  useWsClient: () => ({
    subscribe: (_channel: string, callback: (event: { type: string; payload: { incident?: Record<string, unknown> } }) => void) => {
      mocks.incidentSubscription = callback;
      return () => {
        mocks.incidentSubscription = null;
      };
    },
    onStatusChange: () => () => undefined,
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  updateIncident: mocks.mockUpdateIncident,
}));

import { mapAlertsToVm, useAlertsVm } from "../../../../../../packages/features/alerts/src/hooks";

describe("useAlertsVm", () => {
  it("wires acknowledge, snooze, escalate, and dismiss actions to real incident updates", async () => {
    mocks.incidentData = [
      {
        id: "incident-1",
        severity: "critical",
        title: "Primary region outage",
        summary: "gateway errors",
        createdAt: "2026-05-07T08:00:00.000Z",
        status: "open",
      },
    ];
    mocks.mockUpdateIncident.mockClear();
    mocks.mockInvalidateQueries.mockClear();
    mocks.mockRefetchQueries.mockClear();
    const { result } = renderHook(() => useAlertsVm());

    await act(async () => {
      await result.current.onAcknowledge("incident-1");
      await result.current.onSnooze("incident-1");
      await result.current.onEscalate("incident-1");
      await result.current.onDismiss("incident-1");
    });

    expect(mocks.mockUpdateIncident.mock.calls).toEqual([
      [mocks.mockClient, "incident-1", { status: "acknowledged", owner: "ops-user" }],
      [mocks.mockClient, "incident-1", { snoozedUntil: expect.any(String) }],
      [mocks.mockClient, "incident-1", { status: "mitigating" }],
      [mocks.mockClient, "incident-1", { status: "closed" }],
    ]);
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledTimes(4);
    expect(mocks.mockRefetchQueries).toHaveBeenCalledTimes(4);
    expect(result.current.history.map((entry) => entry.title)).toEqual([
      "Dismissed · Primary region outage",
      "Entered mitigation · Primary region outage",
      "Snoozed 30m · Primary region outage",
      "Acknowledged · Primary region outage",
    ]);
  });

  it("prefers fresher query incidents over stale websocket copies when visibility changed", async () => {
    mocks.incidentData = [
      {
        id: "incident-1",
        severity: "critical",
        title: "Primary region outage",
        summary: "gateway errors",
        createdAt: "2026-05-07T08:00:00.000Z",
        updatedAt: "2026-05-07T08:10:00.000Z",
        status: "closed",
      },
    ];
    const { result } = renderHook(() => useAlertsVm());

    await act(async () => {
      mocks.incidentSubscription?.({
        type: "incident.updated",
        payload: {
          incident: {
            id: "incident-1",
            severity: "critical",
            title: "Primary region outage",
            summary: "gateway errors",
            createdAt: "2026-05-07T08:00:00.000Z",
            updatedAt: "2026-05-07T08:05:00.000Z",
            status: "open",
          },
        },
      });
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("keeps resolved incidents out of the actionable alerts surface", () => {
    mocks.incidentData = [
      {
        id: "incident-open",
        severity: "high",
        title: "Queue lag",
        summary: "lag detected",
        createdAt: "2026-05-08T08:00:00.000Z",
        status: "open",
      },
      {
        id: "incident-resolved",
        severity: "critical",
        title: "Recovered outage",
        summary: "historic incident",
        createdAt: "2026-05-08T07:00:00.000Z",
        status: "resolved",
      },
    ];

    const { result } = renderHook(() => useAlertsVm());

    expect(result.current.items.map((item) => item.id)).toEqual(["incident-open"]);
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
