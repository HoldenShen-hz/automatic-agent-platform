// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { mapIncidentsToVm } from "../../../../../../packages/features/incidents/src/hooks";

describe("mapIncidentsToVm", () => {
  it("prioritizes actionable incidents ahead of resolved and closed history", () => {
    const vm = mapIncidentsToVm([
      {
        id: "incident-closed",
        severity: "high",
        title: "Closed incident",
        summary: "terminal",
        createdAt: "2026-06-06T00:00:00.000Z",
        status: "closed",
      },
      {
        id: "incident-open",
        severity: "high",
        title: "Open incident",
        summary: "actionable",
        createdAt: "2026-06-05T23:00:00.000Z",
        status: "open",
      },
      {
        id: "incident-mitigating",
        severity: "high",
        title: "Mitigating incident",
        summary: "in progress",
        createdAt: "2026-06-05T22:00:00.000Z",
        status: "mitigating",
      },
      {
        id: "incident-resolved",
        severity: "high",
        title: "Resolved incident",
        summary: "terminal",
        createdAt: "2026-06-05T21:00:00.000Z",
        status: "resolved",
      },
    ]);

    expect(vm.items.map((item) => item.id)).toEqual([
      "incident-open",
      "incident-mitigating",
      "incident-resolved",
      "incident-closed",
    ]);
  });
});
