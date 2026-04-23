import type { LearningObject } from "../learn/learning-object-model.js";
import { type ImprovementCandidate } from "../types/improvement-candidate.js";
import type { AutonomyTarget } from "./autonomy-boundary-policy.js";
export type { ImprovementCandidate };
export interface RegisterImprovementCandidateInput {
    taskId: string;
    target: AutonomyTarget;
    learningObjects: readonly LearningObject[];
    description: string;
    expectedBenefit?: string;
}
export declare class ImprovementCandidateRegistry {
    private readonly candidates;
    register(input: RegisterImprovementCandidateInput): ImprovementCandidate;
    list(): ImprovementCandidate[];
    updateStatus(candidateId: string, status: ImprovementCandidate["status"]): ImprovementCandidate | null;
    private mapTargetToScope;
}
