import { z } from "zod";

import {
  BlockerSchema,
  CodebaseSnapshotSchema,
  EnvironmentContextSchema,
  HistoricalContextSchema,
  TaskPhaseSchema,
  UserIntentSchema,
} from "./shared.js";

export const TaskSituationSchema = z.object({
  taskId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  objective: z.string().min(1),
  currentPhase: TaskPhaseSchema,
  userIntent: UserIntentSchema,
  blockers: z.array(BlockerSchema).default([]),
  codebaseSnapshot: CodebaseSnapshotSchema,
  environmentContext: EnvironmentContextSchema,
  historicalContext: HistoricalContextSchema,
  relevantMemory: z.array(z.string()).default([]),
  fileRefs: z.array(z.string()).default([]),
  metrics: z.record(z.string(), z.number()).default({}),
});

export type TaskSituation = z.output<typeof TaskSituationSchema>;

export function parseTaskSituation(input: unknown): TaskSituation {
  return TaskSituationSchema.parse(input);
}

export function createTaskSituationRef(situation: Pick<TaskSituation, "taskId" | "timestamp">): string {
  return `task_situation:${situation.taskId}:${situation.timestamp}`;
}
