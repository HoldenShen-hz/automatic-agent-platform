import type { LearningSignal } from "../../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";
/**
 * Detects model hallucination — when an LLM produces confident but
 * factually incorrect or low-quality output, as measured by a low
 * evaluation score.
 *
 * §8 pattern: Model hallucination (eval < 0.3)
 */
export declare function detectModelHallucination(signal: LearningSignal): FailurePattern | null;
