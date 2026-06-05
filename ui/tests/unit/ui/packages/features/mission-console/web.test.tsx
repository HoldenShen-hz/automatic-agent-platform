import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectMission: vi.fn(),
  performAction: vi.fn(async () => undefined),
}));

vi.mock("../../../../../../packages/features/mission-console/src/hooks", () => ({
  useMissionConsoleVm: () => ({
    loading: false,
    missions: [{
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
    }],
    selectedMission: {
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
    },
    selectedMissionId: "mis_001",
    members: [],
    tasks: [],
    runs: [],
    evidence: [],
    knowledge: [],
    learning: [],
    budget: { status: "configured" },
    missionSettings: [],
    knowledgeLearningSummary: [],
    recommendedActions: [{
      actionId: "activate",
      title: "Activate mission",
      actionLabel: "Activate mission",
      description: "Move from draft into executable state after final objective and policy review.",
    }],
    operatorNotices: [],
    pendingActionId: null,
    actionErrorMessage: "mission action failed",
    selectMission: mocks.selectMission,
    performAction: mocks.performAction,
  }),
}));

import { MissionConsoleWebView } from "../../../../../../packages/features/mission-console/src/web";

describe("MissionConsoleWebView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders actionable mission lifecycle buttons wired to the hook", () => {
    render(<MissionConsoleWebView />);

    fireEvent.click(screen.getByRole("button", { name: "Activate mission" }));

    expect(mocks.performAction).toHaveBeenCalledWith("activate");
    expect(screen.getByText("mission action failed")).toBeInTheDocument();
  });
});
