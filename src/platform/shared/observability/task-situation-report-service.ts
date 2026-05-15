import type { TaskSituation } from "../../five-plane-orchestration/oapeflir/types/index.js";

export class TaskSituationReportService {
  public renderMarkdown(situation: TaskSituation): string {
    const blockers = situation.blockers.length === 0
      ? "- none"
      : situation.blockers.map((blocker: TaskSituation["blockers"][number]) => `- [${blocker.severity}] ${blocker.description}`).join("\n");
    const files = situation.fileRefs.length === 0
      ? "- none"
      : situation.fileRefs.map((fileRef: string) => `- ${fileRef}`).join("\n");
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
