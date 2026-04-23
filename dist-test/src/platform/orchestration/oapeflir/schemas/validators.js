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
import { TaskSituationSchema, UnifiedAssessmentSchema, PlanSchema, DualChannelStepOutputSchema, FeedbackSignalSchema, ImprovementCandidateSchema, RolloutRecordSchema, } from "../types/index.js";
import { LearningObjectSchema } from "../learn/learning-object-model.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const boundaryLogger = new StructuredLogger({ retentionLimit: 500 });
/** Strategy map — exported so callers can reference boundary strategy by name */
export const BOUNDARY_STRATEGY = {
    "O→A": "degrade",
    "A→P": "default",
    "P→E": "abort",
    "E→F": "skip",
    "F→L": "skip",
    "L→I": "skip",
    "I→R": "skip",
};
/** Log-friendly issue formatter */
function formatZodError(err) {
    return err.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
}
// ─── Convenience validators for each boundary ─────────────────────────────────
/** Observe → Assess: TaskSituation validation */
export function validateTaskSituation(data) {
    try {
        return { ok: true, value: TaskSituationSchema.parse(data) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["O→A"];
        boundaryLogger.warn(`[boundary:O→A] validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "O→A" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Assess → Plan: UnifiedAssessment validation */
export function validateUnifiedAssessment(data) {
    try {
        return { ok: true, value: UnifiedAssessmentSchema.parse(data) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["A→P"];
        boundaryLogger.warn(`[boundary:A→P] validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "A→P" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Plan → Execute: Plan validation */
export function validatePlan(data) {
    try {
        return { ok: true, value: PlanSchema.parse(data) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["P→E"];
        boundaryLogger.warn(`[boundary:P→E] validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "P→E" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Execute → Feedback: DualChannelStepOutput[] validation */
export function validateStepOutputs(data) {
    try {
        const arr = Array.isArray(data) ? data : [];
        return { ok: true, value: arr.map((item) => DualChannelStepOutputSchema.parse(item)) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["E→F"];
        boundaryLogger.warn(`[boundary:E→F] stepOutputs validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "E→F" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Execute → Feedback: FeedbackSignal[] validation */
export function validateFeedbackSignals(data) {
    try {
        const arr = Array.isArray(data) ? data : [];
        return { ok: true, value: arr.map((item) => FeedbackSignalSchema.parse(item)) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["E→F"];
        boundaryLogger.warn(`[boundary:E→F] feedbackSignals validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "E→F" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Learn → Improve: ImprovementCandidate[] validation */
export function validateImprovementCandidates(data) {
    try {
        const arr = Array.isArray(data) ? data : [];
        return { ok: true, value: arr.map((item) => ImprovementCandidateSchema.parse(item)) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["L→I"];
        boundaryLogger.warn(`[boundary:L→I] validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "L→I" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Learn → Improve: LearningObject[] validation — ensures objects have required fields before candidate registration */
export function validateLearningObjects(data) {
    try {
        const arr = Array.isArray(data) ? data : [];
        return { ok: true, value: arr.map((item) => LearningObjectSchema.parse(item)) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["L→I"];
        boundaryLogger.warn(`[boundary:L→I] LearningObjects validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "L→I" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/** Improve → Release: RolloutRecord validation */
export function validateRolloutRecord(data) {
    try {
        return { ok: true, value: RolloutRecordSchema.parse(data) };
    }
    catch (err) {
        const zerr = err;
        const strategy = BOUNDARY_STRATEGY["I→R"];
        boundaryLogger.warn(`[boundary:I→R] validation failed — strategy: ${strategy}`, {
            data: { error: formatZodError(zerr), boundary: "I→R" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: zerr };
    }
}
/**
 * F→L boundary: validates that learningSignals is a non-empty array.
 * The actual LearningSignal schema validation is done inside the Learn stage.
 */
export function validateLearningSignalsArray(data) {
    const strategy = BOUNDARY_STRATEGY["F→L"];
    if (!Array.isArray(data) || data.length === 0) {
        boundaryLogger.warn(`[boundary:F→L] learningSignals is empty or not an array — strategy: ${strategy}`, {
            data: { boundary: "F→L" },
        });
        if (strategy === "skip")
            return { ok: false, skipped: true };
        return { ok: false, error: new Error("learningSignals must be a non-empty array") };
    }
    return { ok: true, value: data };
}
//# sourceMappingURL=validators.js.map