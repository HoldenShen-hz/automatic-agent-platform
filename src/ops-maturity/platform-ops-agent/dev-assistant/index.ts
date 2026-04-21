export function summarizeDeveloperAssistSuggestion(subject: string, findings: readonly string[]): string {
  return `${subject}: ${findings.join("; ")}`;
}

export function buildDeveloperAssistChecklist(findings: readonly string[]): string[] {
  return findings.map((item, index) => `${index + 1}. ${item}`);
}
