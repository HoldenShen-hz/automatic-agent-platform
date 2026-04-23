/**
 * Stage boundary validation utilities with §L.14-compliant degradation strategies.
 *
 * Each boundary has a defined fallback behavior when Zod validation fails:
 * - degrade: use a default valid object, continue processing
 * - default: use a fallback value for the output, continue processing
 * - abort: throw an error, stop the pipeline
 * - skip: return null/undefined, skip the dependent stage
 *
 * Reference: GAP-V2 design doc §7.2.4
 */
import { TaskSituationSchema, UnifiedAssessmentSchema, PlanSchema, DualChannelStepOutputSchema, FeedbackSignalSchema, ImprovementCandidateSchema, RolloutRecordSchema } from "../types/index.js";
import { LearningObjectSchema } from "../learn/learning-object-model.js";
/** Boundary name for logging and error attribution */
export type BoundaryName = "O→A" | "A→P" | "P→E" | "E→F" | "F→L" | "L→I" | "I→R";
/**
 * Degradation strategy per §L.14 when validation fails.
 *
 * | Boundary   | Strategy  | Reason                                                                 |
 * |------------|-----------|-------------------------------------------------------------------------|
 * | O→A        | degrade   | Observe can tolerate precision loss                                    |
 * | A→P        | default   | Assessment failure should not block execution                           |
 * | P→E        | abort     | No valid plan should not execute                                       |
 * | E→F        | skip      | Execution result priority > feedback                                   |
 * | F→L        | skip      | Learning is side-chain, does not block main chain                       |
 * | L→I        | skip      | Improvement is side-chain, does not block main chain                   |
 * | I→R        | skip      | Release is side-chain, does not block main chain                       |
 */
export type DegradeStrategy = "degrade" | "default" | "abort" | "skip";
/** Strategy map — exported so callers can reference boundary strategy by name */
export declare const BOUNDARY_STRATEGY: Record<BoundaryName, DegradeStrategy>;
/** Validation result - either a valid value or skipped if strategy is "skip" */
export type ValidationResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: Error;
    skipped?: undefined;
} | {
    ok: false;
    skipped: true;
    error?: undefined;
};
/** Observe → Assess: TaskSituation validation */
export declare function validateTaskSituation(data: unknown): ValidationResult<ReturnType<typeof TaskSituationSchema.parse>>;
/** Assess → Plan: UnifiedAssessment validation */
export declare function validateUnifiedAssessment(data: unknown): ValidationResult<ReturnType<typeof UnifiedAssessmentSchema.parse>>;
/** Plan → Execute: Plan validation */
export declare function validatePlan(data: unknown): ValidationResult<ReturnType<typeof PlanSchema.parse>>;
/** Execute → Feedback: DualChannelStepOutput[] validation */
export declare function validateStepOutputs(data: unknown): ValidationResult<ReturnType<typeof DualChannelStepOutputSchema.parse>[]>;
/** Execute → Feedback: FeedbackSignal[] validation */
export declare function validateFeedbackSignals(data: unknown): ValidationResult<ReturnType<typeof FeedbackSignalSchema.parse>[]>;
/** Learn → Improve: ImprovementCandidate[] validation */
export declare function validateImprovementCandidates(data: unknown): ValidationResult<ReturnType<typeof ImprovementCandidateSchema.parse>[]>;
/** Learn → Improve: LearningObject[] validation — ensures objects have required fields before candidate registration */
export declare function validateLearningObjects(data: unknown): ValidationResult<ReturnType<typeof LearningObjectSchema.parse>[]>;
/** Improve → Release: RolloutRecord validation */
export declare function validateRolloutRecord(data: unknown): ValidationResult<ReturnType<typeof RolloutRecordSchema.parse>>;
/**
 * F→L boundary: validates that learningSignals is a non-empty array.
 * The actual LearningSignal schema validation is done inside the Learn stage.
 */
export declare function validateLearningSignalsArray(data: unknown): ValidationResult<unknown[]>;
