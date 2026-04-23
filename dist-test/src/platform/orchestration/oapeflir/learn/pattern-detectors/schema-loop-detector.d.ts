import type { LearningSignal } from "../../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";
/**
 * Detects repeated schema validation failures on the same step —
 * indicating the model is in a repair loop trying different outputs
 * that keep failing validation.
 *
 * §8 pattern: Schema validation loop (repair >= 3 on same step)
 */
export declare function detectSchemaValidationLoop(signals: readonly LearningSignal[], minOccurrences?: number): FailurePattern | null;
