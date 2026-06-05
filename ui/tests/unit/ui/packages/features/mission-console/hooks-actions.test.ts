// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MissionDTO } from "@aa/shared-types";

const mocks = vi.hoisted(() => ({
  client: { post: vi.fn(), get: vi.fn() },
  activateMission: vi.fn(async () => ({ ok: true })),
  pauseMission: vi.fn(async () => ({ ok: true })),
  resumeMission: vi.fn(async () => ({ ok: true })),
  freezeMission: vi.fn(async () => ({ ok: true })),
  unfreezeMission: vi.fn(async () => ({ ok: true })),
  completeMission: vi.fn(async () => ({ ok: true })),
  archiveMission: vi.fn(async () => ({ ok: true })),
  fetchMissionMembers: vi.fn(async () => []),
  fetchMissionTasks: vi.fn(async () => []),
  fetchMissionRuns: vi.fn(async () => []),
  fetchMissionEvidence: vi.fn(async () => []),
  fetchMissionKnowledge: vi.fn(async () => []),
  fetchMissionLearning: vi.fn(async () => []),
  fetchMissionBudget: vi.fn(async () => ({ status: "configured" })),
  invalidateQueries: vi.fn(async () => undefined),
  refetchQueries: vi.fn(async () => undefined),
}));

let missionData: readonly MissionDTO[] = [];

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    refetchQueries: mocks.refetchQueries,
  }),
}));

vi.mock("@aa/shared-state", () => ({
  missionControlQueryKeys: { missions: ["missions"] },
  useRestClient: () => mocks.client,
  useMissionsQuery: () => ({
    data: missionData,
    isLoading: false,
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  activateMission: mocks.activateMission,
  pauseMission: mocks.pauseMission,
  resumeMission: mocks.resumeMission,
  freezeMission: mocks.freezeMission,
  unfreezeMission: mocks.unfreezeMission,
  completeMission: mocks.completeMission,
  archiveMission: mocks.archiveMission,
  fetchMissionMembers: mocks.fetchMissionMembers,
  fetchMissionTasks: mocks.fetchMissionTasks,
  fetchMissionRuns: mocks.fetchMissionRuns,
  fetchMissionEvidence: mocks.fetchMissionEvidence,
  fetchMissionKnowledge: mocks.fetchMissionKnowledge,
  fetchMissionLearning: mocks.fetchMissionLearning,
  fetchMissionBudget: mocks.fetchMissionBudget,
}));

import { useMissionConsoleVm } from "../../../../../../packages/features/mission-console/src/hooks";

describe("useMissionConsoleVm action wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    missionData = [{
      missionId: "mis_001",
      tenantId: "tenant_001",
      type: "formal",
      status: "draft",
      priority: "high",
      title: "Release Mission",
      objective: "Ship evidence-backed release",
      successCriteria: ["approved"],
      domainId: "coding",
      ownerPrincipalId: "user_001",
      accountablePrincipalId: "user_101",
      policyRefs: ["policy.release"],
      riskProfileRef: "risk.release",
      budgetEnvelopeRef: "budget_001",
      knowledgeBoundaryRef: "kb.release",
      defaultWorkflowTemplateRefs: ["wf.release"],
      updatedAt: "2026-05-21T00:00:00.000Z",
    }];
  });

  it("executes real mission lifecycle mutations and refreshes mission queries", async () => {
    const { result } = renderHook(() => useMissionConsoleVm());

    await waitFor(() => {
      expect(result.current.selectedMissionId).toBe("mis_001");
      expect(result.current.recommendedActions[0]?.actionId).toBe("activate");
    });

    await act(async () => {
      await result.current.performAction("activate");
    });

    expect(mocks.activateMission).toHaveBeenCalledWith(mocks.client, "mis_001");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["missions"] });
    expect(mocks.refetchQueries).toHaveBeenCalledWith({ queryKey: ["missions"], type: "active" });
  });

  it("surfaces lifecycle mutation failures instead of hiding them in the UI", async () => {
    mocks.activateMission.mockRejectedValueOnce(new Error("mission-action-failed"));
    const { result } = renderHook(() => useMissionConsoleVm());

    await waitFor(() => {
      expect(result.current.selectedMissionId).toBe("mis_001");
    });

    await act(async () => {
      await expect(result.current.performAction("activate")).rejects.toThrow(/mission-action-failed/);
    });

    expect(result.current.actionErrorMessage).toBe("mission-action-failed");
    expect(result.current.pendingActionId).toBeNull();
  });
});
