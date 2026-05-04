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
  // R13-05 FIX: Track both failure AND success patterns. Success patterns
  // reveal effective strategies that should be preserved and promoted.
  private readonly successPatterns: LearningObject[] = [];

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

  // R13-05 FIX: Mine success patterns from non-failure signals.
  // Success patterns reveal effective strategies that should be distilled
  // and preserved for future use, not just discarded.
  public mineSuccessPatterns(signals: readonly LearningSignal[]): LearningObject[] {
    const successSignals = signals.filter((s) => s.learningType === "failure_pattern" || s.learningType === "recovery_playbook");
    const results: LearningObject[] = [];

    for (const signal of successSignals) {
      if (signal.learningType === "recovery_playbook" || signal.learningType === "user_correction") {
        // These are inherently positive signals - record them as success patterns
        const obj = this.successSignalToLearningObject(signal);
        results.push(obj);
        this.successPatterns.push(obj);
      }
    }

    return results;
  }

  /**
   * Returns all recorded success patterns for persistence/promotion.
   */
  public getSuccessPatterns(): readonly LearningObject[] {
    return [...this.successPatterns];
  }

  /**
   * Clears the success pattern buffer. Call after persistence/promotion.
   */
  public clearSuccessPatterns(): void {
    this.successPatterns.length = 0;
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
      learningType: "failure_pattern",
      title: pattern.title,
      summary: pattern.summary,
      confidence: 0.8,
      evidenceRefs: pattern.evidenceRefs,
      sourceSignalIds: pattern.sourceSignalIds,
      recommendation: pattern.recommendation,
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: String(pattern.detectedAt),
    };
  }

  private genericFailure(signal: LearningSignal): LearningObject {
    return {
      learningObjectId: newId("learning"),
      learningType: "failure_pattern",
      title: `Failure pattern: ${signal.valueSummary.slice(0, 40)}`,
      summary: signal.valueSummary,
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
      sourceSignalIds: signal.sourceSignalIds,
      recommendation: "Prefer replanning with narrower scope and stronger validation.",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: String(signal.generatedAt),
    };
  }

  // R13-05 FIX: Convert success/recovery signals to learning objects
  private successSignalToLearningObject(signal: LearningSignal): LearningObject {
    return {
      learningObjectId: newId("learning"),
      learningType: signal.learningType === "recovery_playbook" ? "recovery_playbook" : "user_correction",
      title: `Success pattern: ${signal.valueSummary.slice(0, 40)}`,
      summary: signal.valueSummary,
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
      sourceSignalIds: signal.sourceSignalIds,
      recommendation: "Preserve this effective strategy for similar future tasks.",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: String(signal.generatedAt),
    };
  }
}
