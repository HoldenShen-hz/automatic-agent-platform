import type { LearningSignal } from "../../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";
/**
 * Detects tool permission denials — tool calls that were blocked because
 * of sandbox policy or missing approval.
 *
 * §8 pattern: Tool permission denial
 */
export declare function detectToolPermissionDenial(signal: LearningSignal): FailurePattern | null;
