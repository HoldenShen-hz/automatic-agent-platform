import type { Blocker, RelevantFile, TaskPhase, TaskSituation } from "../../orchestration/oapeflir/types/index.js";
import { parseTaskSituation } from "../../orchestration/oapeflir/types/index.js";

export type { TaskSituation };

export interface TaskSituationInput {
  taskId: string;
  domainId?: string;
  objective: string;
  currentPhase: TaskPhase;
  userInput?: string;
  normalizedIntent?: string;
  intentConfidence?: number;
  blockers?: readonly (string | Blocker)[];
  fileRefs?: readonly string[];
  relevantFiles?: readonly RelevantFile[];
  relevantMemory?: readonly string[];
  metrics?: Record<string, number>;
  previousTaskIds?: readonly string[];
  lastExecutionOutcome?: string;
  availableTools?: readonly string[];
  workingDirectory?: string;
  gitRef?: string;
}

export class TaskSituationBuilder {
  public build(input: TaskSituationInput): TaskSituation {
    const blockers = (input.blockers ?? []).map((blocker) =>
      typeof blocker === "string"
        ? { description: blocker, severity: "medium" as const }
        : { ...blocker },
    );
    const fileRefs = [...(input.fileRefs ?? [])];
    const relevantFiles = [...(input.relevantFiles ?? fileRefs.map((path) => ({ path })))];
    return parseTaskSituation({
      taskId: input.taskId,
      ...(input.domainId != null ? { domainId: input.domainId } : {}),
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
