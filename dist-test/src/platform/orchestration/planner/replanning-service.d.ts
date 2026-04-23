import type { Plan } from "../oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
export interface ReplanningTrigger {
    triggerId: string;
    taskId: string;
    reasonCode: string;
    source: "feedback" | "validation" | "operator";
    summary: string;
}
export interface ReplanningDecision {
    decisionId: string;
    taskId: string;
    shouldReplan: boolean;
    nextPlanVersion: number | null;
    strategy: Plan["strategy"] | null;
    reasonCode: string;
    decidedAt: number;
}
export declare class ReplanningService {
    createTrigger(taskId: string, reasonCode: string, source: ReplanningTrigger["source"], summary: string): ReplanningTrigger;
    decide(plan: Plan, feedback: FeedbackBatch, trigger?: ReplanningTrigger | null): ReplanningDecision;
}
