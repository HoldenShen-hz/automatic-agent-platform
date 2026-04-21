import type { LearningSignal } from "../../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";
/**
 * Detects LLM output truncation — when the model hits max_tokens or the
 * finish_reason is "length" / "stop" with suspiciously uniform token counts.
 *
 * §8 pattern: LLM truncation (max_tokens hit)
 */
export declare function detectLlmTruncation(signal: LearningSignal): FailurePattern | null;
