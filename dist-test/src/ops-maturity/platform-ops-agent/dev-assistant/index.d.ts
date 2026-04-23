export declare function summarizeDeveloperAssistSuggestion(subject: string, findings: readonly string[]): string;
export declare function buildDeveloperAssistChecklist(findings: readonly string[]): string[];
export interface DeveloperAssistRecommendation {
    readonly summary: string;
    readonly checklist: readonly string[];
    readonly severity: "info" | "warning" | "critical";
    readonly findingCount: number;
}
export declare class DeveloperAssistantService {
    recommend(subject: string, findings: readonly string[]): DeveloperAssistRecommendation;
}
