export interface PromptInjectionSignal {
    readonly signal: string;
    readonly pattern: RegExp;
    readonly weight: number;
}
export interface PromptInjectionClassification {
    readonly blocked: boolean;
    readonly score: number;
    readonly threshold: number;
    readonly matchedSignals: readonly string[];
    readonly confidence: "high" | "medium" | "low";
}
export interface PromptProtectionPlan {
    readonly classification: PromptInjectionClassification;
    readonly guardedPrompt: string;
    readonly canaryToken: string;
    readonly allowExecution: boolean;
    readonly riskLevel: "high" | "medium" | "low";
}
export interface PromptProtectionInspection {
    readonly leaked: boolean;
    readonly leakedToken: string | null;
}
export interface MLInjectionClassifierConfig {
    readonly signals: readonly PromptInjectionSignal[];
    readonly threshold: number;
    readonly highConfidenceThreshold: number;
    readonly mediumConfidenceThreshold: number;
}
export declare const DEFAULT_ML_CLASSIFIER_CONFIG: MLInjectionClassifierConfig;
export declare function classifyPromptInjectionRisk(input: string, threshold?: number, config?: MLInjectionClassifierConfig): PromptInjectionClassification;
export interface CanaryTokenResult {
    readonly token: string;
    readonly prompt: string;
}
export declare function embedCanaryToken(prompt: string, scope: string): CanaryTokenResult;
export declare function detectCanaryTokenLeakage(output: string, token: string): boolean;
export declare function classifyRiskLevel(score: number, threshold: number): "high" | "medium" | "low";
export declare function protectSystemPrompt(input: {
    systemPrompt: string;
    userInput: string;
    scope: string;
    threshold?: number;
    config?: MLInjectionClassifierConfig;
}): PromptProtectionPlan;
export declare function inspectProtectedModelOutput(output: string, token: string): PromptProtectionInspection;
