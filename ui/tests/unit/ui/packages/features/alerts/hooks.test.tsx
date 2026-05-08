import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const invalidateQueries = vi.fn(async () => undefined);
const mockClient = {};
const acknowledgeIncident = vi.fn(async () => ({ ok: true }));
const startIncidentMitigation = vi.fn(async () => ({ ok: true }));
const resolveIncident = vi.fn(async () => ({ ok: true }));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

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
  useWsClient: () => ({
    subscribe: () => () => undefined,
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  acknowledgeIncident: (...args: unknown[]) => acknowledgeIncident(...args),
  startIncidentMitigation: (...args: unknown[]) => startIncidentMitigation(...args),
  resolveIncident: (...args: unknown[]) => resolveIncident(...args),
}));

import { mapAlertsToVm, useAlertsVm } from "../../../../../../packages/features/alerts/src/hooks";

describe("useAlertsVm", () => {
  it("wires acknowledge/mitigate/resolve actions to the incident API and refreshes incidents", async () => {
    const { result } = renderHook(() => useAlertsVm());

    await act(async () => {
      await result.current.acknowledgeAlert("incident-1");
      await result.current.startMitigation("incident-1");
      await result.current.resolveAlert("incident-1");
    });

    expect(acknowledgeIncident).toHaveBeenCalledWith(mockClient, "incident-1", "ops-user");
    expect(startIncidentMitigation).toHaveBeenCalledWith(mockClient, "incident-1");
    expect(resolveIncident).toHaveBeenCalledWith(mockClient, "incident-1");
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(result.current.items).toHaveLength(0);
  });

  it("sorts by severity, filters by domain/time/severity, and supports dismiss", () => {
    const { result } = renderHook(() => mapAlertsToVm([
      {
        id: "incident-1",
        severity: "high",
        title: "Queue lag",
        summary: "lag detected",
        createdAt: new Date().toISOString(),
        domainId: "platform",
      },
      {
        id: "incident-2",
        severity: "critical",
        title: "Approval outage",
        summary: "approval blocked",
        createdAt: new Date().toISOString(),
        domainId: "governance",
      },
    ]));

    expect(result.current.items.map((item) => item.id)).toEqual(["incident-2", "incident-1"]);
    expect(result.current.availableDomains).toEqual(["governance", "platform"]);

    act(() => {
      result.current.setFilter({ severity: "critical", domainId: "governance" });
    });
    expect(result.current.items.map((item) => item.id)).toEqual(["incident-2"]);

    act(() => {
      result.current.dismissAlert("incident-2");
    });
    expect(result.current.items).toHaveLength(0);
  });
});
