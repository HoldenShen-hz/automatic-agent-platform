export function summarizeDeveloperAssistSuggestion(subject: string, findings: readonly string[]): string {
  return `${subject}: ${findings.join("; ")}`;
}

export function buildDeveloperAssistChecklist(findings: readonly string[]): string[] {
  return findings.map((item, index) => `${index + 1}. ${item}`);
}

export interface DeveloperAssistRecommendation {
  readonly summary: string;
  readonly checklist: readonly string[];
  readonly severity: "info" | "warning" | "critical";
  readonly findingCount: number;
}

export class DeveloperAssistantService {
  public recommend(subject: string, findings: readonly string[]): DeveloperAssistRecommendation {
    const severity: DeveloperAssistRecommendation["severity"] = findings.length >= 5
      ? "critical"
      : findings.length >= 3
        ? "warning"
        : "info";

    return {
      summary: summarizeDeveloperAssistSuggestion(subject, findings),
      checklist: buildDeveloperAssistChecklist(findings),
      severity,
      findingCount: findings.length,
    };
  }
}
