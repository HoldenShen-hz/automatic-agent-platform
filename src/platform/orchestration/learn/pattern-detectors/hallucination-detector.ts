import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";

/**
 * Detects model hallucination — when an LLM produces confident but
 * factually incorrect or low-quality output, as measured by a low
 * evaluation score.
 *
 * §8 pattern: Model hallucination (eval < 0.3)
 */
export function detectModelHallucination(signal: LearningSignal): FailurePattern | null {
  const {
    evidence = {},
    valueSummary = "",
    taskId = "",
    learningSignalId = "",
    evidenceRefs = [],
    sourceSignalIds = [],
  } = signal as Partial<LearningSignal>;
  const ev = evidence as Record<string, unknown>;
  const lineage = [...new Set([...sourceSignalIds, learningSignalId])];

  const evalScore = Number(ev.evalScore ?? ev.eval_score ?? ev.qualityScore ?? 0);

  // Threshold from §8 spec: eval < 0.3
  if (evalScore > 0 && evalScore < 0.3) {
    const modelId = String(ev.modelId ?? ev.model ?? "unknown");
    return {
      patternType: "model_hallucination",
      taskId,
      stepId: String(ev.stepId ?? ""),
      title: `Model hallucination detected — eval score ${evalScore.toFixed(2)}`,
      summary: `Model "${modelId}" produced output with very low evaluation score (${evalScore.toFixed(2)}). ${valueSummary}`,
      evidenceRefs: [...evidenceRefs],
      sourceSignalIds: lineage,
      recommendation:
        "Switch to a more reliable model for this task type, or provide additional grounding context to reduce hallucination risk.",
      detectedAt: signal.generatedAt,
    };
  }

  return null;
}
