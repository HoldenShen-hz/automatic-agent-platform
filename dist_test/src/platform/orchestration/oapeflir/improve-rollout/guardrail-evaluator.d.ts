import type { ImprovementCandidate } from "./improvement-candidate-registry.js";
import type { StrategyVersion } from "./strategy-versioning.js";
export interface GuardrailEvaluation {
    allowed: boolean;
    reasonCodes: string[];
}
export declare class GuardrailEvaluator {
    evaluate(candidate: ImprovementCandidate, strategyVersion: StrategyVersion): GuardrailEvaluation;
}
