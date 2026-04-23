import type { Blocker, RelevantFile, TaskPhase, TaskSituation } from "../../orchestration/oapeflir/types/index.js";
export type { TaskSituation };
export interface TaskSituationInput {
    taskId: string;
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
export declare class TaskSituationBuilder {
    build(input: TaskSituationInput): TaskSituation;
}
