import { useState } from "react";
import { useDomainConfigsQuery } from "@aa/shared-state";

export type WizardStep = "domain-select" | "risk-profile" | "capability-config" | "review";

export interface DomainWizardStep {
  readonly id: WizardStep;
  readonly label: string;
  readonly description: string;
}

export interface DomainWizardVm {
  readonly items: readonly { title: string; description: string }[];
  readonly steps: readonly DomainWizardStep[];
  readonly currentStep: WizardStep;
  readonly setCurrentStep: (step: WizardStep) => void;
  readonly selectedDomainId: string | null;
  readonly setSelectedDomainId: (id: string | null) => void;
  readonly riskProfile: {
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly dataClassification: "public" | "internal" | "confidential" | "restricted";
    readonly hasExternalIntegration: boolean;
    readonly setRiskLevel: (level: "low" | "medium" | "high" | "critical") => void;
    readonly setDataClassification: (classification: "public" | "internal" | "confidential" | "restricted") => void;
    readonly setHasExternalIntegration: (value: boolean) => void;
  };
  readonly capabilityConfig: {
    readonly maxConcurrentTasks: number;
    readonly allowedDrillDepth: 1 | 2 | 3 | 4 | 5;
    readonly enableAutoRollback: boolean;
    readonly setMaxConcurrentTasks: (value: number) => void;
    readonly setAllowedDrillDepth: (depth: 1 | 2 | 3 | 4 | 5) => void;
    readonly setEnableAutoRollback: (value: boolean) => void;
  };
  readonly submitConfig: () => void;
}

const WIZARD_STEPS: readonly DomainWizardStep[] = [
  { id: "domain-select", label: "选择域", description: "选择要配置的领域" },
  { id: "risk-profile", label: "风险配置", description: "设置风险等级和数据分类" },
  { id: "capability-config", label: "能力配置", description: "配置并发任务和钻取深度" },
  { id: "review", label: "审核确认", description: "审核并提交配置" },
];

const STORAGE_KEY = "aa-domain-wizard-draft";

interface WizardDraft {
  currentStep: WizardStep;
  selectedDomainId: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  dataClassification: "public" | "internal" | "confidential" | "restricted";
  hasExternalIntegration: boolean;
  maxConcurrentTasks: number;
  allowedDrillDepth: 1 | 2 | 3 | 4 | 5;
  enableAutoRollback: boolean;
  savedAt: string;
}

function loadDraft(): Partial<WizardDraft> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as WizardDraft;
    // Draft expires after 24 hours
    const age = Date.now() - new Date(draft.savedAt).getTime();
    if (age > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(draft: WizardDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
}

export function useDomainWizardVm(): DomainWizardVm {
  const domains = useDomainConfigsQuery().data ?? [];

  // §2265: Load persisted draft on mount - restores wizard state across refreshes
  const savedDraft = loadDraft();
  const [currentStep, setCurrentStepRaw] = useState<WizardStep>(savedDraft?.currentStep ?? "domain-select");
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(savedDraft?.selectedDomainId ?? null);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high" | "critical">(savedDraft?.riskLevel ?? "medium");
  const [dataClassification, setDataClassification] = useState<"public" | "internal" | "confidential" | "restricted">(savedDraft?.dataClassification ?? "internal");
  const [hasExternalIntegration, setHasExternalIntegration] = useState(savedDraft?.hasExternalIntegration ?? false);
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(savedDraft?.maxConcurrentTasks ?? 5);
  const [allowedDrillDepth, setAllowedDrillDepth] = useState<1 | 2 | 3 | 4 | 5>(savedDraft?.allowedDrillDepth ?? 3);
  const [enableAutoRollback, setEnableAutoRollback] = useState(savedDraft?.enableAutoRollback ?? true);

  // §2265: Persist draft whenever state changes
  function setCurrentStep(step: WizardStep) {
    setCurrentStepRaw(step);
    saveDraft({
      currentStep: step,
      selectedDomainId,
      riskLevel,
      dataClassification,
      hasExternalIntegration,
      maxConcurrentTasks,
      allowedDrillDepth,
      enableAutoRollback,
      savedAt: new Date().toISOString(),
    });
  }

  function handleSetSelectedDomainId(id: string | null) {
    setSelectedDomainId(id);
    saveDraft({
      currentStep,
      selectedDomainId: id,
      riskLevel,
      dataClassification,
      hasExternalIntegration,
      maxConcurrentTasks,
      allowedDrillDepth,
      enableAutoRollback,
      savedAt: new Date().toISOString(),
    });
  }

  // Wrap setters to auto-save draft
  function setRiskLevelAndSave(level: "low" | "medium" | "high" | "critical") {
    setRiskLevel(level);
    saveDraft({ currentStep, selectedDomainId, riskLevel: level, dataClassification, hasExternalIntegration, maxConcurrentTasks, allowedDrillDepth, enableAutoRollback, savedAt: new Date().toISOString() });
  }

  function setDataClassificationAndSave(c: "public" | "internal" | "confidential" | "restricted") {
    setDataClassification(c);
    saveDraft({ currentStep, selectedDomainId, riskLevel, dataClassification: c, hasExternalIntegration, maxConcurrentTasks, allowedDrillDepth, enableAutoRollback, savedAt: new Date().toISOString() });
  }

  function setHasExternalIntegrationAndSave(value: boolean) {
    setHasExternalIntegration(value);
    saveDraft({ currentStep, selectedDomainId, riskLevel, dataClassification, hasExternalIntegration: value, maxConcurrentTasks, allowedDrillDepth, enableAutoRollback, savedAt: new Date().toISOString() });
  }

  function setMaxConcurrentTasksAndSave(value: number) {
    setMaxConcurrentTasks(value);
    saveDraft({ currentStep, selectedDomainId, riskLevel, dataClassification, hasExternalIntegration, maxConcurrentTasks: value, allowedDrillDepth, enableAutoRollback, savedAt: new Date().toISOString() });
  }

  function setAllowedDrillDepthAndSave(depth: 1 | 2 | 3 | 4 | 5) {
    setAllowedDrillDepth(depth);
    saveDraft({ currentStep, selectedDomainId, riskLevel, dataClassification, hasExternalIntegration, maxConcurrentTasks, allowedDrillDepth: depth, enableAutoRollback, savedAt: new Date().toISOString() });
  }

  function setEnableAutoRollbackAndSave(value: boolean) {
    setEnableAutoRollback(value);
    saveDraft({ currentStep, selectedDomainId, riskLevel, dataClassification, hasExternalIntegration, maxConcurrentTasks, allowedDrillDepth, enableAutoRollback: value, savedAt: new Date().toISOString() });
  }

  // §2265: Clear draft after successful submission
  function clearPersistedDraft() {
    clearDraft();
  }

  // Expose clearPersistedDraft via a wrapper that the web view can call on submit
  const submitConfig = () => {
    clearDraft();
    // In production this would call the domain config API
    alert("配置已提交！");
  };

  return {
    items: domains.map((domain) => ({
      title: domain.displayName,
      description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
    })),
    steps: WIZARD_STEPS,
    currentStep,
    setCurrentStep,
    selectedDomainId,
    setSelectedDomainId: handleSetSelectedDomainId,
    riskProfile: {
      riskLevel,
      dataClassification,
      hasExternalIntegration,
      setRiskLevel: setRiskLevelAndSave,
      setDataClassification: setDataClassificationAndSave,
      setHasExternalIntegration: setHasExternalIntegrationAndSave,
    },
    capabilityConfig: {
      maxConcurrentTasks,
      allowedDrillDepth,
      enableAutoRollback,
      setMaxConcurrentTasks: setMaxConcurrentTasksAndSave,
      setAllowedDrillDepth: setAllowedDrillDepthAndSave,
      setEnableAutoRollback: setEnableAutoRollbackAndSave,
    },
    submitConfig,
  };
}
