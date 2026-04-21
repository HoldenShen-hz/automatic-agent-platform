import type { Plan } from "../../orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
export interface ExecutionDeviation {
    deviationId: string;
    taskId: string;
    severity: "low" | "medium" | "high" | "critical";
    reasonCode: string;
    summary: string;
    detectedAt: number;
}
export declare class ExecutionDeviationDetector {
    detect(plan: Plan, feedback: FeedbackBatch): ExecutionDeviation[];
}
