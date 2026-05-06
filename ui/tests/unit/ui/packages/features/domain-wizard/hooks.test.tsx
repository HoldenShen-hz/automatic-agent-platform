import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/shared-state", () => ({
  useDomainConfigsQuery: () => ({
    data: [{ displayName: "Marketing", owner: "growth-ops", defaultDrillDepth: 3 }],
  }),
}));

import { useDomainWizardVm } from "../../../../../../packages/features/domain-wizard/src/hooks";

describe("useDomainWizardVm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("restores drafts from storage, persists edits, and clears the draft on submit", () => {
    localStorage.setItem("aa-domain-wizard-draft", JSON.stringify({
      currentStep: "risk-profile",
      selectedDomainId: "domain-1",
      riskLevel: "high",
      dataClassification: "restricted",
      hasExternalIntegration: true,
      maxConcurrentTasks: 8,
      allowedDrillDepth: 4,
      enableAutoRollback: false,
      savedAt: new Date().toISOString(),
    }));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    const { result } = renderHook(() => useDomainWizardVm());

    expect(result.current.currentStep).toBe("risk-profile");
    expect(result.current.selectedDomainId).toBe("domain-1");
    expect(result.current.riskProfile.riskLevel).toBe("high");

    act(() => {
      result.current.capabilityConfig.setMaxConcurrentTasks(12);
    });

    const persisted = JSON.parse(localStorage.getItem("aa-domain-wizard-draft") ?? "{}");
    expect(persisted.maxConcurrentTasks).toBe(12);

    act(() => {
      result.current.submitConfig();
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(localStorage.getItem("aa-domain-wizard-draft")).toBeNull();
  });
});
