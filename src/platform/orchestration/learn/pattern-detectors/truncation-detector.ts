import { newId } from "../../../contracts/types/ids.js";
import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern, FailurePatternType } from "./failure-pattern-model.js";

/**
 * Detects LLM output truncation — when the model hits max_tokens or the
 * finish_reason is "length" / "stop" with suspiciously uniform token counts.
 *
 * §8 pattern: LLM truncation (max_tokens hit)
 */
export function detectLlmTruncation(signal: LearningSignal): FailurePattern | null {
  const { evidence, valueSummary, taskId, learningSignalId, evidenceRefs, sourceSignalIds } = signal;
  const ev = evidence as Record<string, unknown>;
  const lineage = [...new Set([...sourceSignalIds, learningSignalId])];

  const finishReason = String(ev.finishReason ?? ev.finish_reason ?? "");
  const maxTokens = Number(ev.maxTokens ?? ev.max_tokens ?? 0);
  const tokensUsed = Number(ev.tokensUsed ?? ev.tokens_used ?? 0);
  const finishReasonLength = finishReason === "length" || finishReason === "stop";

  // Primary signal: explicit finish_reason="length"
  if (finishReason === "length") {
    return {
      patternType: "llm_truncation",
      taskId,
      stepId: String(ev.stepId ?? ""),
      title: "LLM output truncated — max_tokens reached",
      summary: `Model output was truncated at ${tokensUsed} tokens (max_tokens=${maxTokens}). ${valueSummary}`,
      evidenceRefs: [...evidenceRefs],
      sourceSignalIds: lineage,
      recommendation:
        "Increase max_tokens budget for this task type, or compress the context to leave more room for generation.",
      detectedAt: signal.generatedAt,
    };
  }

  // Secondary signal: tokens used is suspiciously close to max_tokens (>95%)
  if (maxTokens > 0 && tokensUsed >= maxTokens * 0.95 && tokensUsed > 0) {
    return {
      patternType: "llm_truncation",
      taskId,
      stepId: String(ev.stepId ?? ""),
      title: "LLM output near token limit",
      summary: `Model output used ${tokensUsed}/${maxTokens} tokens (${Math.round((tokensUsed / maxTokens) * 100)}%). ${valueSummary}`,
      evidenceRefs: [...evidenceRefs],
      sourceSignalIds: lineage,
      recommendation:
        "Consider increasing max_tokens or simplifying the prompt to reduce input token count.",
      detectedAt: signal.generatedAt,
    };
  }

  return null;
}
