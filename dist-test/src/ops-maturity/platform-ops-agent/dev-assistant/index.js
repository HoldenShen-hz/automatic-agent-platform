export function summarizeDeveloperAssistSuggestion(subject, findings) {
    return `${subject}: ${findings.join("; ")}`;
}
export function buildDeveloperAssistChecklist(findings) {
    return findings.map((item, index) => `${index + 1}. ${item}`);
}
export class DeveloperAssistantService {
    recommend(subject, findings) {
        const severity = findings.length >= 5
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
//# sourceMappingURL=index.js.map