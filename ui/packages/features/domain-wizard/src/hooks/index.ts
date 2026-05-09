import { useCallback, useEffect, useMemo, useState } from "react";
import { useDomainConfigsQuery } from "@aa/shared-state";

export type DomainWizardStepId = "basics" | "policy" | "preview";

export interface DomainWizardDraft {
  readonly displayName: string;
  readonly owner: string;
  readonly drillDepth: number;
  readonly visibility: "private" | "shared" | "public";
  readonly summary: string;
}

export interface DomainWizardVm {
  readonly steps: readonly { id: DomainWizardStepId; title: string; status: "current" | "complete" | "upcoming" }[];
  readonly currentStep: DomainWizardStepId;
  readonly draft: DomainWizardDraft;
  readonly previewRows: readonly { key: string; value: string }[];
  readonly validationErrors: readonly string[];
  readonly catalogItems: readonly { title: string; description: string }[];
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  goBack(): void;
  goNext(): void;
  setField<K extends keyof DomainWizardDraft>(field: K, value: DomainWizardDraft[K]): void;
  loadTemplate(displayName: string): void;
}

const STORAGE_KEY = "aa.domain-wizard.draft";
const orderedSteps: readonly DomainWizardStepId[] = ["basics", "policy", "preview"];

export function createDefaultDraft(): DomainWizardDraft {
  return {
    displayName: "",
    owner: "",
    drillDepth: 3,
    visibility: "shared",
    summary: "",
  };
}

export function validateDomainWizardDraft(step: DomainWizardStepId, draft: DomainWizardDraft): readonly string[] {
  const errors: string[] = [];
  if (step === "basics" || step === "preview") {
    if (draft.displayName.trim().length < 3) {
      errors.push("Display name must contain at least 3 characters.");
    }
    if (draft.owner.trim().length === 0) {
      errors.push("Owner is required.");
    }
  }
  if (step === "policy" || step === "preview") {
    if (draft.drillDepth < 1 || draft.drillDepth > 5) {
      errors.push("Drill depth must stay between 1 and 5.");
    }
    if (draft.summary.trim().length < 10) {
      errors.push("Summary must contain at least 10 characters.");
    }
  }
  return errors;
}

export function createPreviewRows(draft: DomainWizardDraft): readonly { key: string; value: string }[] {
  return [
    { key: "Display name", value: draft.displayName || "Unspecified" },
    { key: "Owner", value: draft.owner || "Unspecified" },
    { key: "Drill depth", value: String(draft.drillDepth) },
    { key: "Visibility", value: draft.visibility },
    { key: "Summary", value: draft.summary || "Unspecified" },
  ];
}

function readStoredDraft(): DomainWizardDraft {
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
      ...(JSON.parse(raw) as Partial<DomainWizardDraft>),
    };
  } catch {
    return createDefaultDraft();
  }
}

export function useDomainWizardVm(): DomainWizardVm {
  const domains = useDomainConfigsQuery().data ?? [];
  const [currentStep, setCurrentStep] = useState<DomainWizardStepId>("basics");
  const [draft, setDraft] = useState<DomainWizardDraft>(readStoredDraft);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const validationErrors = useMemo(() => validateDomainWizardDraft(currentStep, draft), [currentStep, draft]);
  const currentIndex = orderedSteps.indexOf(currentStep);

  const goBack = useCallback(() => {
    if (currentIndex <= 0) {
      return;
    }
    setCurrentStep(orderedSteps[currentIndex - 1] ?? "basics");
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (validationErrors.length > 0 || currentIndex >= orderedSteps.length - 1) {
      return;
    }
    setCurrentStep(orderedSteps[currentIndex + 1] ?? "preview");
  }, [currentIndex, validationErrors.length]);

  const setField = useCallback(<K extends keyof DomainWizardDraft>(field: K, value: DomainWizardDraft[K]) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const loadTemplate = useCallback((displayName: string) => {
    const template = domains.find((domain) => domain.displayName === displayName);
    if (template == null) {
      return;
    }
    setDraft({
      displayName: template.displayName,
      owner: template.owner,
      drillDepth: template.defaultDrillDepth,
      visibility: "shared",
      summary: `${template.displayName} onboarding for ${template.owner}.`,
    });
  }, [domains]);

  return {
    steps: orderedSteps.map((step, index) => ({
      id: step,
      title: step === "basics" ? "Basics" : step === "policy" ? "Policy" : "Preview",
      status: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
    })),
    currentStep,
    draft,
    previewRows: createPreviewRows(draft),
    validationErrors,
    catalogItems: domains.map((domain) => ({
      title: domain.displayName,
      description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
    })),
    canGoBack: currentIndex > 0,
    canGoNext: validationErrors.length === 0 && currentIndex < orderedSteps.length - 1,
    goBack,
    goNext,
    setField,
    loadTemplate,
  };
}
