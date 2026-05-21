import { describe, expect, it } from "vitest";
import { mapMissionsToConsoleVm } from "../../../../../../packages/features/mission-console/src/hooks";
import { createMissionConsoleMobileCards } from "../../../../../../packages/features/mission-console/src/mobile";
import type { MissionDTO } from "@aa/shared-types";

const missions: readonly MissionDTO[] = [{
  missionId: "mis_001",
  tenantId: "tenant_001",
  type: "formal",
  status: "active",
  priority: "high",
  title: "Release Mission",
  objective: "Ship evidence-backed release",
  successCriteria: ["approved"],
  domainId: "coding",
  ownerPrincipalId: "user_001",
  budgetEnvelopeRef: "budget_001",
  updatedAt: "2026-05-21T00:00:00.000Z",
}, {
  missionId: "mis_002",
  tenantId: "tenant_001",
  type: "incident",
  status: "paused",
  priority: "critical",
  title: "Incident Mission",
  objective: "Restore service",
  successCriteria: ["healthy"],
  domainId: "operations",
  ownerPrincipalId: "user_002",
  budgetEnvelopeRef: null,
  updatedAt: "2026-05-21T00:01:00.000Z",
}];

describe("Mission Console VM seams", () => {
  it("selects requested Mission while keeping DTOs outside feature props", () => {
    const vm = mapMissionsToConsoleVm(missions, "mis_002");

    expect(vm.selectedMission?.title).toBe("Incident Mission");
    expect(vm.selectedMissionId).toBe("mis_002");
  });

  it("builds mobile cards from selected Mission evidence state", () => {
    const cards = createMissionConsoleMobileCards({
      loading: false,
      ...mapMissionsToConsoleVm(missions, "mis_001"),
      tasks: [],
      runs: [],
      evidence: [{ id: "ev_001", missionId: "mis_001", type: "evidence", status: "recorded", title: "Snapshot", ref: "hash", updatedAt: "2026-05-21T00:00:00.000Z" }],
      budget: null,
      selectMission() {},
    });

    expect(cards[0]?.evidenceCount).toBe(1);
    expect(cards[1]?.evidenceCount).toBe(0);
  });
});
