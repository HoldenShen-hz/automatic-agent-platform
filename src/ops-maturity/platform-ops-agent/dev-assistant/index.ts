export function summarizeDeveloperAssistSuggestion(subject: string, findings: readonly string[]): string {
  return `${subject}: ${findings.join("; ")}`;
}
