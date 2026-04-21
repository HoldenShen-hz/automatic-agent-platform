import type { PromptTemplateRecord } from "../registry/index.js";
export type PromptRolloutMode = "off" | "suggest" | "shadow";
export type PromptRolloutStatus = "draft" | "ready" | "active" | "blocked" | "rolled_back";
export interface PromptRolloutRecord {
    rolloutId: string;
    templateKey: string;
    version: string;
    mode: PromptRolloutMode;
    status: PromptRolloutStatus;
    owner: string;
    fixedPrefixHash: string;
    regressionSuiteId: string;
    regressionPassed: boolean;
    guardrailSummary: string;
    createdAt: string;
    updatedAt: string;
}
export interface PromptRolloutDecision {
    allowed: boolean;
    nextStatus: PromptRolloutStatus;
    reason: string;
}
export declare class PromptRolloutService {
    private readonly rollouts;
    createRollout(input: {
        template: PromptTemplateRecord;
        mode: PromptRolloutMode;
        owner: string;
        regressionSuiteId: string;
        regressionPassed: boolean;
        domainBlockCompatible: boolean;
    }): PromptRolloutRecord;
    activateRollout(rolloutId: string): PromptRolloutRecord;
    rollbackRollout(rolloutId: string, reason: string): PromptRolloutRecord;
    evaluateGuardrail(input: {
        mode: PromptRolloutMode;
        regressionPassed: boolean;
        domainBlockCompatible: boolean;
    }): PromptRolloutDecision;
    listRollouts(templateKey?: string): PromptRolloutRecord[];
    private getRequired;
}
export * from "./platform-prompt-release-orchestration-service.js";
