export class TaskSituationReportService {
    renderMarkdown(situation) {
        const blockers = situation.blockers.length === 0
            ? "- none"
            : situation.blockers.map((blocker) => `- [${blocker.severity}] ${blocker.description}`).join("\n");
        const files = situation.fileRefs.length === 0
            ? "- none"
            : situation.fileRefs.map((fileRef) => `- ${fileRef}`).join("\n");
        const metrics = Object.keys(situation.metrics).length === 0
            ? "- none"
            : Object.entries(situation.metrics).map(([name, value]) => `- ${name}: ${value}`).join("\n");
        return [
            `# Task Situation ${situation.taskId}`,
            "",
            `- objective: ${situation.objective}`,
            `- phase: ${situation.currentPhase}`,
            `- intent: ${situation.userIntent.normalized}`,
            `- confidence: ${situation.userIntent.confidence}`,
            "",
            "## Blockers",
            blockers,
            "",
            "## File Refs",
            files,
            "",
            "## Metrics",
            metrics,
        ].join("\n");
    }
}
//# sourceMappingURL=task-situation-report-service.js.map