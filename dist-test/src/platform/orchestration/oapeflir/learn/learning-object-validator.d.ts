import { type LearningObject } from "./learning-object-model.js";
export interface LearningObjectValidationResult {
    valid: boolean;
    reasonCode: string;
    learningObject: LearningObject;
}
export declare class LearningObjectValidator {
    validate(input: LearningObject): LearningObjectValidationResult;
    validateMany(inputs: readonly LearningObject[]): LearningObject[];
}
