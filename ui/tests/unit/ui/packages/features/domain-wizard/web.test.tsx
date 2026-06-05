// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/ui-core", async () => {
  const actual = await vi.importActual<typeof import("@aa/ui-core")>("@aa/ui-core");
  return {
    ...actual,
    FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("../../../../../../packages/features/domain-wizard/src/hooks", () => ({
  useDomainWizardVm: () => ({
    items: [{ id: "security", title: "Security", description: "owner <img src=x onerror=alert(1)> · drill 3" }],
    steps: [
      { id: "domain-select", label: "选择域", description: "选择要配置的领域" },
      { id: "risk-profile", label: "风险配置", description: "设置风险等级和数据分类" },
      { id: "capability-config", label: "能力配置", description: "配置并发任务和钻取深度" },
      { id: "review", label: "审核确认", description: "在本地交接前审核配置" },
    ],
    currentStep: "domain-select",
    setCurrentStep: vi.fn(),
    selectedDomainId: null,
    setSelectedDomainId: vi.fn(),
    riskProfile: {
      riskLevel: "medium",
      dataClassification: "internal",
      hasExternalIntegration: false,
      setRiskLevel: vi.fn(),
      setDataClassification: vi.fn(),
      setHasExternalIntegration: vi.fn(),
    },
    capabilityConfig: {
      maxConcurrentTasks: 5,
      allowedDrillDepth: 3,
      enableAutoRollback: true,
      setMaxConcurrentTasks: vi.fn(),
      setAllowedDrillDepth: vi.fn(),
      setEnableAutoRollback: vi.fn(),
    },
    submissionMessage: null,
    isSubmitting: false,
    submitConfig: vi.fn(),
    canGoBack: false,
    canGoNext: false,
    goBack: vi.fn(),
    goNext: vi.fn(),
  }),
}));

import { DomainWizardWebView } from "../../../../../../packages/features/domain-wizard/src/web";

afterEach(() => {
  cleanup();
});

describe("DomainWizardWebView", () => {
  it("renders owner descriptions as escaped text instead of HTML", () => {
    render(<DomainWizardWebView />);

    expect(screen.queryByText("owner <img src=x onerror=alert(1)> · drill 3")).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});
