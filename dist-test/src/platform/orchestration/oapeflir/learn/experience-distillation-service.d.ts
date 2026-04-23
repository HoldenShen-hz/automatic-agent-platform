import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
export declare class ExperienceDistillationService {
    distill(signals: readonly LearningSignal[]): LearningObject[];
}
