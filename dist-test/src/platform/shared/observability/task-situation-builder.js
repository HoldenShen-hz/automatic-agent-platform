import { parseTaskSituation } from "../../orchestration/oapeflir/types/index.js";
export class TaskSituationBuilder {
    build(input) {
        const blockers = (input.blockers ?? []).map((blocker) => typeof blocker === "string"
            ? { description: blocker, severity: "medium" }
            : { ...blocker });
        const fileRefs = [...(input.fileRefs ?? [])];
        const relevantFiles = [...(input.relevantFiles ?? fileRefs.map((path) => ({ path })))];
        return parseTaskSituation({
            taskId: input.taskId,
            timestamp: Date.now(),
            objective: input.objective,
            currentPhase: input.currentPhase,
            userIntent: {
                raw: input.userInput ?? input.objective,
                normalized: input.normalizedIntent ?? input.objective,
                confidence: input.intentConfidence ?? 0.9,
            },
            blockers,
            codebaseSnapshot: {
                rootPath: input.workingDirectory ?? process.cwd(),
                fileCount: relevantFiles.length,
                relevantFiles,
                gitRef: input.gitRef,
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: input.workingDirectory ?? process.cwd(),
                availableTools: [...(input.availableTools ?? ["read", "apply_patch", "test"])],
            },
            historicalContext: {
                previousTaskIds: [...(input.previousTaskIds ?? [])],
                relatedMemoryRefs: [...(input.relevantMemory ?? [])],
                lastExecutionOutcome: input.lastExecutionOutcome,
            },
            relevantMemory: [...(input.relevantMemory ?? [])],
            fileRefs,
            metrics: { ...(input.metrics ?? {}) },
        });
    }
}
//# sourceMappingURL=task-situation-builder.js.map