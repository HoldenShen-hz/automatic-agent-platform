import type { LearningObject } from "../learn/learning-object-model.js";
export type AutonomyTarget = "routing_policy" | "planning_policy" | "execution_policy" | "memory_policy" | "sandbox_policy" | "provider_registry";
export interface AutonomyBoundaryDecision {
    allowed: boolean;
    reasonCode: string;
}
export declare class AutonomyBoundaryPolicy {
    decide(target: AutonomyTarget, learningObjects: readonly LearningObject[]): AutonomyBoundaryDecision;
}
