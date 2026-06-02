import { newId } from "../../contracts/types/ids.js";
import type { LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
import {
  detectLlmTruncation,
  detectSchemaValidationLoop,
  detectToolPermissionDenial,
  detectModelHallucination,
} from "./pattern-detectors/index.js";

export class FailurePatternMiner {
  public mine(signals: readonly LearningSignal[]): LearningObject[] {
    const results: LearningObject[] = [];
    const unmatched: LearningSignal[] = [];

    for (const signal of signals) {
      if (signal.learningType !== "failure_pattern") continue;

      const pattern =
        detectLlmTruncation(signal) ??
        detectToolPermissionDenial(signal) ??
        detectModelHallucination(signal);

      if (pattern) {
        results.push(this.patternToLearningObject(pattern));
      } else {
        unmatched.push(signal);
      }
    }

    const schemaLoop = detectSchemaValidationLoop(signals);
    if (schemaLoop) {
      results.push(this.patternToLearningObject(schemaLoop));
    }

    for (const signal of unmatched) {
      results.push(this.genericFailure(signal));
    }

    return results;
  }

  private patternToLearningObject(pattern: {
    patternType: string;
    taskId: string;
    stepId?: string | undefined;
    title: string;
    summary: string;
    evidenceRefs: string[];
    sourceSignalIds: string[];
    recommendation: string;
    detectedAt: number;
  }): LearningObject {
    return {
      learningObjectId: newId("learning"),
      objectId: newId("learning"),
      learningType: "failure_pattern",
      kind: "failure_pattern",
      title: pattern.title,
      summary: pattern.summary,
      content: {
        title: pattern.title,
        summary: pattern.summary,
        evidenceRefs: pattern.evidenceRefs,
        sourceSignalIds: pattern.sourceSignalIds,
        recommendation: pattern.recommendation,
      },
      confidence: computeMinedFailureConfidence(pattern.evidenceRefs.length, pattern.sourceSignalIds.length),
      evidenceRefs: pattern.evidenceRefs,
      sourceSignalIds: pattern.sourceSignalIds,
      recommendation: pattern.recommendation,
      validatedBy: "none",
      promotionStatus: "quarantined",
      status: "rejected",
      createdAt: String(pattern.detectedAt),
    };
  }

  private genericFailure(signal: LearningSignal): LearningObject {
    const evidenceRefs = signal.evidenceRefs.length > 0
      ? signal.evidenceRefs
      : [signal.sourceFeedbackId].filter(Boolean);
    return {
      learningObjectId: newId("learning"),
      objectId: newId("learning"),
      learningType: "failure_pattern",
      kind: "failure_pattern",
      title: `Failure pattern: ${signal.valueSummary.slice(0, 40)}`,
      summary: signal.valueSummary,
      content: {
        title: `Failure pattern: ${signal.valueSummary.slice(0, 40)}`,
        summary: signal.valueSummary,
        evidenceRefs,
        sourceSignalIds: signal.sourceSignalIds,
        recommendation: "Prefer replanning with narrower scope and stronger validation.",
      },
      confidence: signal.confidence,
      evidenceRefs,
      sourceSignalIds: signal.sourceSignalIds,
      recommendation: "Prefer replanning with narrower scope and stronger validation.",
      validatedBy: "none",
      promotionStatus: "quarantined",
      status: "rejected",
      createdAt: String(signal.generatedAt),
    };
  }
}

function computeMinedFailureConfidence(evidenceRefCount: number, sourceSignalCount: number): number {
  const boundedEvidence = Math.min(Math.max(evidenceRefCount, 0), 4);
  const boundedSignals = Math.min(Math.max(sourceSignalCount, 0), 4);
  return Number(Math.min(0.78, 0.5 + boundedEvidence * 0.06 + boundedSignals * 0.04).toFixed(2));
}
