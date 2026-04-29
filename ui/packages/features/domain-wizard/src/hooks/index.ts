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
}

const WIZARD_STEPS: readonly DomainWizardStep[] = [
  { id: "domain-select", label: "选择域", description: "选择要配置的领域" },
  { id: "risk-profile", label: "风险配置", description: "设置风险等级和数据分类" },
  { id: "capability-config", label: "能力配置", description: "配置并发任务和钻取深度" },
  { id: "review", label: "审核确认", description: "审核并提交配置" },
];

export function useDomainWizardVm(): DomainWizardVm {
  const domains = useDomainConfigsQuery().data ?? [];
  const [currentStep, setCurrentStep] = useState<WizardStep>("domain-select");
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [dataClassification, setDataClassification] = useState<"public" | "internal" | "confidential" | "restricted">("internal");
  const [hasExternalIntegration, setHasExternalIntegration] = useState(false);
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(5);
  const [allowedDrillDepth, setAllowedDrillDepth] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [enableAutoRollback, setEnableAutoRollback] = useState(true);

  return {
    items: domains.map((domain) => ({
      title: domain.displayName,
      description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
    })),
    steps: WIZARD_STEPS,
    currentStep,
    setCurrentStep,
    selectedDomainId,
    setSelectedDomainId,
    riskProfile: {
      riskLevel,
      dataClassification,
      hasExternalIntegration,
      setRiskLevel,
      setDataClassification,
      setHasExternalIntegration,
    },
    capabilityConfig: {
      maxConcurrentTasks,
      allowedDrillDepth,
      enableAutoRollback,
      setMaxConcurrentTasks,
      setAllowedDrillDepth,
      setEnableAutoRollback,
    },
  };
}
