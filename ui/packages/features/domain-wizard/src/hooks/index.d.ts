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
    readonly items: readonly {
        title: string;
        description: string;
    }[];
    readonly steps: readonly {
        id: DomainWizardStepId;
        label: string;
        description: string;
    }[];
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
    readonly catalogItems: readonly {
        title: string;
        description: string;
    }[];
    readonly previewRows: readonly {
        key: string;
        value: string;
    }[];
    readonly validationErrors: readonly string[];
    readonly submissionMessage: string | null;
    readonly canGoBack: boolean;
    readonly canGoNext: boolean;
    setCurrentStep(step: DomainWizardStepId): void;
    setSelectedDomainId(domainId: string | null): void;
    goBack(): void;
    goNext(): void;
    loadTemplate(domainIdOrName: string): void;
    submitConfig(): void;
}
export declare function useDomainWizardVm(): DomainWizardVm;
