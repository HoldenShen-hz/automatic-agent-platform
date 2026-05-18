import { useCallback, useEffect, useMemo, useState } from "react";
import { useDomainConfigsQuery } from "@aa/shared-state";

export type DomainWizardStepId = "domain-select" | "risk-profile" | "capability-config" | "review";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export interface DomainWizardPersistedDraft {
  readonly currentStep: DomainWizardStepId;
  readonly selectedDomainId: string | null;
  readonly riskLevel: RiskLevel;
  readonly dataClassification: DataClassification;
  readonly hasExternalIntegration: boolean;
  readonly maxConcurrentTasks: number;
  readonly allowedDrillDepth: number;
  readonly enableAutoRollback: boolean;
  readonly savedAt: string;
}

export interface DomainWizardVm {
  readonly items: readonly { title: string; description: string }[];
  readonly steps: readonly { id: DomainWizardStepId; label: string; description: string }[];
  readonly currentStep: DomainWizardStepId;
  readonly selectedDomainId: string | null;
  readonly riskProfile: {
    readonly riskLevel: RiskLevel;
    readonly dataClassification: DataClassification;
    readonly hasExternalIntegration: boolean;
    setRiskLevel(value: RiskLevel): void;
    setDataClassification(value: DataClassification): void;
    setHasExternalIntegration(value: boolean): void;
  };
  readonly capabilityConfig: {
    readonly maxConcurrentTasks: number;
    readonly allowedDrillDepth: number;
    readonly enableAutoRollback: boolean;
    setMaxConcurrentTasks(value: number): void;
    setAllowedDrillDepth(value: number): void;
    setEnableAutoRollback(value: boolean): void;
  };
  readonly catalogItems: readonly { title: string; description: string }[];
  readonly previewRows: readonly { key: string; value: string }[];
  readonly validationErrors: readonly string[];
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  setCurrentStep(step: DomainWizardStepId): void;
  setSelectedDomainId(domainId: string | null): void;
  goBack(): void;
  goNext(): void;
  loadTemplate(domainIdOrName: string): void;
  submitConfig(): void;
}

const STORAGE_KEY = "aa-domain-wizard-draft";
const orderedSteps: readonly DomainWizardStepId[] = ["domain-select", "risk-profile", "capability-config", "review"];

const stepDescriptors: readonly DomainWizardVm["steps"] = [
  { id: "domain-select", label: "选择域", description: "选择要配置的领域" },
  { id: "risk-profile", label: "风险配置", description: "设置风险等级和数据分类" },
  { id: "capability-config", label: "能力配置", description: "配置并发任务和钻取深度" },
  { id: "review", label: "审核确认", description: "审核并提交配置" },
];

function createDefaultDraft(): DomainWizardPersistedDraft {
  return {
    currentStep: "domain-select",
    selectedDomainId: null,
    riskLevel: "medium",
    dataClassification: "internal",
    hasExternalIntegration: false,
    maxConcurrentTasks: 5,
    allowedDrillDepth: 3,
    enableAutoRollback: true,
    savedAt: new Date(0).toISOString(),
  };
}

function readStoredDraft(): DomainWizardPersistedDraft {
  if (typeof window === "undefined") {
    return createDefaultDraft();
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw == null) {
    return createDefaultDraft();
  }
  try {
    return {
      ...createDefaultDraft(),
      ...(JSON.parse(raw) as Partial<DomainWizardPersistedDraft>),
    };
  } catch {
    return createDefaultDraft();
  }
}

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.round(value));
}

export function useDomainWizardVm(): DomainWizardVm {
  const stored = useMemo(readStoredDraft, []);
  const domains = useDomainConfigsQuery().data ?? [];
  const [currentStep, setCurrentStep] = useState<DomainWizardStepId>(stored.currentStep);
  const [selectedDomainId, setSelectedDomainIdState] = useState<string | null>(stored.selectedDomainId);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(stored.riskLevel);
  const [dataClassification, setDataClassification] = useState<DataClassification>(stored.dataClassification);
  const [hasExternalIntegration, setHasExternalIntegration] = useState(stored.hasExternalIntegration);
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(stored.maxConcurrentTasks);
  const [allowedDrillDepth, setAllowedDrillDepth] = useState(stored.allowedDrillDepth);
  const [enableAutoRollback, setEnableAutoRollback] = useState(stored.enableAutoRollback);

  const items = useMemo(() => domains.map((domain) => ({
    title: domain.displayName,
    description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
  })), [domains]);

  const persist = useCallback((next: Partial<DomainWizardPersistedDraft> = {}) => {
    if (typeof window === "undefined") {
      return;
    }
    const draft: DomainWizardPersistedDraft = {
      currentStep,
      selectedDomainId,
      riskLevel,
      dataClassification,
      hasExternalIntegration,
      maxConcurrentTasks,
      allowedDrillDepth,
      enableAutoRollback,
      savedAt: new Date().toISOString(),
      ...next,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [
    allowedDrillDepth,
    currentStep,
    dataClassification,
    enableAutoRollback,
    hasExternalIntegration,
    maxConcurrentTasks,
    riskLevel,
    selectedDomainId,
  ]);

  useEffect(() => {
    persist();
  }, [persist]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (selectedDomainId == null) {
      errors.push("Select a domain before continuing.");
    }
    if (currentStep === "risk-profile" || currentStep === "review") {
      if (riskLevel === "critical" && dataClassification === "public") {
        errors.push("Critical domains cannot be marked public.");
      }
    }
    if (currentStep === "capability-config" || currentStep === "review") {
      if (maxConcurrentTasks < 1) {
        errors.push("Max concurrent tasks must be at least 1.");
      }
      if (allowedDrillDepth < 1 || allowedDrillDepth > 5) {
        errors.push("Allowed drill depth must stay between 1 and 5.");
      }
    }
    return errors;
  }, [allowedDrillDepth, currentStep, dataClassification, maxConcurrentTasks, riskLevel, selectedDomainId]);

  const currentIndex = orderedSteps.indexOf(currentStep);

  const applyDomainTemplate = useCallback((domainIdOrName: string) => {
    const template = domains.find((domain) => domain.id === domainIdOrName || domain.displayName === domainIdOrName);
    if (template == null) {
      return;
    }
    const nextSelectedId = template.id ?? domainIdOrName;
    setSelectedDomainIdState(nextSelectedId);
    setAllowedDrillDepth(template.defaultDrillDepth);
    persist({
      selectedDomainId: nextSelectedId,
      allowedDrillDepth: template.defaultDrillDepth,
    });
  }, [domains, persist]);

  const previewRows = useMemo(() => [
    { key: "Domain", value: selectedDomainId ?? "Unspecified" },
    { key: "Risk level", value: riskLevel },
    { key: "Data classification", value: dataClassification },
    { key: "External integrations", value: hasExternalIntegration ? "enabled" : "disabled" },
    { key: "Max concurrent tasks", value: String(maxConcurrentTasks) },
    { key: "Allowed drill depth", value: String(allowedDrillDepth) },
    { key: "Auto rollback", value: enableAutoRollback ? "enabled" : "disabled" },
  ], [allowedDrillDepth, dataClassification, enableAutoRollback, hasExternalIntegration, maxConcurrentTasks, riskLevel, selectedDomainId]);

  return {
    items,
    steps: stepDescriptors,
    currentStep,
    selectedDomainId,
    riskProfile: {
      riskLevel,
      dataClassification,
      hasExternalIntegration,
      setRiskLevel(value) {
        setRiskLevel(value);
        persist({ riskLevel: value });
      },
      setDataClassification(value) {
        setDataClassification(value);
        persist({ dataClassification: value });
      },
      setHasExternalIntegration(value) {
        setHasExternalIntegration(value);
        persist({ hasExternalIntegration: value });
      },
    },
    capabilityConfig: {
      maxConcurrentTasks,
      allowedDrillDepth,
      enableAutoRollback,
      setMaxConcurrentTasks(value) {
        const normalized = normalizePositiveInt(value, 1);
        setMaxConcurrentTasks(normalized);
        persist({ maxConcurrentTasks: normalized });
      },
      setAllowedDrillDepth(value) {
        const normalized = Math.min(5, normalizePositiveInt(value, 1));
        setAllowedDrillDepth(normalized);
        persist({ allowedDrillDepth: normalized });
      },
      setEnableAutoRollback(value) {
        setEnableAutoRollback(value);
        persist({ enableAutoRollback: value });
      },
    },
    catalogItems: items,
    previewRows,
    validationErrors,
    canGoBack: currentIndex > 0,
    canGoNext: currentIndex < orderedSteps.length - 1 && validationErrors.length === 0,
    setCurrentStep(step) {
      setCurrentStep(step);
      persist({ currentStep: step });
    },
    setSelectedDomainId(domainId) {
      setSelectedDomainIdState(domainId);
      persist({ selectedDomainId: domainId });
      if (domainId != null) {
        applyDomainTemplate(domainId);
      }
    },
    goBack() {
      const previousStep = orderedSteps[Math.max(0, currentIndex - 1)] ?? "domain-select";
      setCurrentStep(previousStep);
      persist({ currentStep: previousStep });
    },
    goNext() {
      const nextStep = orderedSteps[Math.min(orderedSteps.length - 1, currentIndex + 1)] ?? "review";
      setCurrentStep(nextStep);
      persist({ currentStep: nextStep });
    },
    loadTemplate: applyDomainTemplate,
    submitConfig() {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      window.alert("Domain configuration submitted");
    },
  };
}
