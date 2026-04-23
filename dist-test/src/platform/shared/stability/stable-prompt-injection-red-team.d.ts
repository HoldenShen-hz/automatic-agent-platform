/**
 * Stable prompt injection red-team suite.
 *
 * Validates that representative prompt-injection payloads are detected,
 * redacted when secrets appear, and persisted as machine-readable evidence.
 */
import { type InjectionRisk, type PromptInjectionRuleId } from "../../execution/tool-executor/tool-output-sanitizer.js";
export interface StablePromptInjectionRedTeamOptions {
    outputDir: string;
}
export interface StablePromptInjectionCaseDefinition {
    scenarioId: string;
    rawOutput: string;
    expectedRisk: InjectionRisk;
    expectedRuleIds: PromptInjectionRuleId[];
    expectedWarnings: string[];
    expectsRedaction: boolean;
}
export interface StablePromptInjectionScenarioResult {
    scenarioId: string;
    passed: boolean;
    durationMs: number;
    summary: string;
    expectedRisk: InjectionRisk;
    actualRisk: InjectionRisk;
    matchedRuleIds: PromptInjectionRuleId[];
    warnings: string[];
    redactionCount: number;
    sanitizedExcerpt: string;
}
export interface StablePromptInjectionRedTeamReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    artifacts: {
        reportPath: string;
    };
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StablePromptInjectionScenarioResult[];
}
export declare const STABLE_PROMPT_INJECTION_RED_TEAM_CASES: readonly StablePromptInjectionCaseDefinition[];
export declare function runStablePromptInjectionRedTeam(options: StablePromptInjectionRedTeamOptions): Promise<StablePromptInjectionRedTeamReport>;
export declare function writeStablePromptInjectionRedTeamReport(outputFile: string, report: StablePromptInjectionRedTeamReport): void;
