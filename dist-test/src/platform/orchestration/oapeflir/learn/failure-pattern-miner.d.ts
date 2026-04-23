import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
export declare class FailurePatternMiner {
    mine(signals: readonly LearningSignal[]): LearningObject[];
    private patternToLearningObject;
    private genericFailure;
}
