import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
vi.stubGlobal("fetch", fetchMock);

vi.mock("@aa/shared-state", () => ({
  useDomainConfigsQuery: () => ({
    data: [{ id: "marketing", displayName: "Marketing", owner: "growth-ops", defaultDrillDepth: 3 }],
  }),
  useAuthState: (selector: (state: { accessToken: string }) => string) => selector({ accessToken: "test-token" }),
}));

import { useDomainWizardVm } from "../../../../../../packages/features/domain-wizard/src/hooks";

describe("useDomainWizardVm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    fetchMock.mockClear();
  });

  it("restores drafts from storage, persists edits, and submits to the backend on review", async () => {
    localStorage.setItem("aa-domain-wizard-draft", JSON.stringify({
      currentStep: "risk-profile",
      selectedDomainId: "marketing",
      riskLevel: "high",
      dataClassification: "restricted",
      hasExternalIntegration: true,
      maxConcurrentTasks: 8,
      allowedDrillDepth: 4,
      enableAutoRollback: false,
      savedAt: new Date().toISOString(),
    }));
    const { result } = renderHook(() => useDomainWizardVm());

    expect(result.current.currentStep).toBe("risk-profile");
    expect(result.current.selectedDomainId).toBe("marketing");
    expect(result.current.riskProfile.riskLevel).toBe("high");

    act(() => {
      result.current.capabilityConfig.setMaxConcurrentTasks(12);
    });

    const persisted = JSON.parse(localStorage.getItem("aa-domain-wizard-draft") ?? "{}");
    expect(persisted.maxConcurrentTasks).toBe(12);

    await act(async () => {
      await result.current.submitConfig();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.submissionMessage).toContain("已提交到后端目录");
    expect(localStorage.getItem("aa-domain-wizard-draft")).toBeNull();
  });

  it("exposes multi-step navigation and capability/risk controls", () => {
    const { result } = renderHook(() => useDomainWizardVm());

    expect(result.current.selectedDomainId).toBe("marketing");
    expect(result.current.previewRows[0]?.value).toBe("Marketing");

    expect(result.current.steps.map((step) => step.id)).toEqual([
      "domain-select",
      "risk-profile",
      "capability-config",
      "review",
    ]);

    act(() => {
      result.current.setCurrentStep("risk-profile");
      result.current.riskProfile.setRiskLevel("critical");
      result.current.capabilityConfig.setAllowedDrillDepth(5);
    });

    expect(result.current.currentStep).toBe("risk-profile");
    expect(result.current.riskProfile.riskLevel).toBe("critical");
    expect(result.current.capabilityConfig.allowedDrillDepth).toBe(5);
  });

  it("allows finishing the flow on the review step when validation passes", () => {
    const { result } = renderHook(() => useDomainWizardVm());

    act(() => {
      result.current.setCurrentStep("review");
    });

    expect(result.current.currentStep).toBe("review");
    expect(result.current.validationErrors).toEqual([]);
    expect(result.current.canGoNext).toBe(true);
  });
});
