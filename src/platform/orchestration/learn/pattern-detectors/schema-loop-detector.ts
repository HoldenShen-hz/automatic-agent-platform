import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";

/**
 * Detects repeated schema validation failures on the same step —
 * indicating the model is in a repair loop trying different outputs
 * that keep failing validation.
 *
 * §8 pattern: Schema validation loop (repair >= 3 on same step)
 */
export function detectSchemaValidationLoop(
  signals: readonly LearningSignal[],
  minOccurrences = 3,
): FailurePattern | null {
  if (!Array.isArray(signals)) {
    return null;
  }

  // Group failure_pattern signals by stepId
  const stepIdMap = new Map<string, LearningSignal[]>();

  for (const signal of signals) {
    if (signal.learningType !== "failure_pattern") continue;
    const stepId = String((signal.evidence as Record<string, unknown>).stepId ?? "");
    if (!stepId) continue;
    const key = `${signal.taskId}:${stepId}`;
    const list = stepIdMap.get(key) ?? [];
    list.push(signal);
    stepIdMap.set(key, list);
  }

  for (const [_key, group] of stepIdMap) {
    if (group.length >= minOccurrences) {
      const first = group[0]!;
      const repairAttempts = group.length;
      return {
        patternType: "schema_validation_loop",
        taskId: first.taskId,
        stepId: String((first.evidence as Record<string, unknown>)?.stepId ?? ""),
        title: `Schema validation loop detected — ${repairAttempts} repair attempts`,
        summary: `Step repeatedly failed schema validation ${repairAttempts} times before succeeding or giving up. ${first.valueSummary ?? ""}`,
        evidenceRefs: group.map((s) => s.learningSignalId),
        sourceSignalIds: group.map((s) => s.learningSignalId),
        recommendation:
          "Simplify the output schema for this step, or switch to a more capable model for structured output tasks.",
        detectedAt: Date.now(),
      };
    }
  }

  return null;
}
