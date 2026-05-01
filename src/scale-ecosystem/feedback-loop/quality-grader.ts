/**
 * Feedback Quality Grader
 *
 * Assesses feedback signals for quality and suitability for model fine-tuning.
 * Filters out noise, contradictions, and low-information feedback.
 */

import type { FeedbackSignal } from "../../platform/orchestration/oapeflir/types/feedback-signal.js";
import type { LearningSignal } from "./collector/feedback-model.js";

export interface QualityScore {
  readonly overall: number;
  readonly signalQuality: number;
  readonly diversityScore: number;
  readonly informationDensity: number;
  readonly labelReliability: number;
}

export interface QualityGrade {
  readonly grade: "discard" | "low" | "medium" | "high";
  readonly score: QualityScore;
  readonly reasons: readonly string[];
}

export interface GradingOptions {
  minOverallScore?: number;
  minSignalQuality?: number;
  requireHumanSource?: boolean;
  maxAgeDays?: number;
}

const DEFAULT_GRADING_OPTIONS: Required<GradingOptions> = {
  minOverallScore: 0.5,
  minSignalQuality: 0.4,
  requireHumanSource: false,
  maxAgeDays: 30,
};

function assessSignalQuality(signal: FeedbackSignal): number {
  let score = 0.5;

  // Human-generated feedback is higher quality
  if (signal.source === "user" || signal.source === "hitl") {
    score += 0.3;
  }

  // Corrections and failures carry more information
  if (signal.category === "correction") {
    score += 0.25;
  } else if (signal.category === "failure" || signal.category === "timeout") {
    score += 0.2;
  } else if (signal.category === "success") {
    score -= 0.15;
  }

  // Higher severity indicates more important feedback
  if (signal.severity === "critical") {
    score += 0.15;
  } else if (signal.severity === "error") {
    score += 0.1;
  } else if (signal.severity === "warning") {
    score += 0.05;
  }

  // Rich payload indicates detailed feedback
  const payloadKeys = Object.keys(signal.payload);
  if (payloadKeys.length > 3) {
    score += 0.1;
  }
  if (payloadKeys.length > 1 && signal.payload["reasonCode"]) {
    score += 0.1;
  }

  // Step references indicate traceable feedback
  if (signal.stepOutputRefs.length > 0) {
    score += 0.05;
  }

  return Math.min(1, Math.max(0, score));
}

function assessDiversity(signals: readonly FeedbackSignal[]): number {
  if (signals.length === 0) return 0;
  if (signals.length === 1) return 0.3;

  const categories = new Set(signals.map((s) => s.category));
  const sources = new Set(signals.map((s) => s.source));
  const severities = new Set(signals.map((s) => s.severity));

  const categoryRatio = categories.size / 5;
  const sourceRatio = sources.size / 5;
  const severityRatio = severities.size / 4;

  return Math.min(1, (categoryRatio + sourceRatio + severityRatio) / 3);
}

function assessInformationDensity(signals: readonly FeedbackSignal[]): number {
  if (signals.length === 0) return 0;

  let totalLength = 0;
  for (const signal of signals) {
    const summary = signal.payload["summary"];
    const reasonCode = signal.payload["reasonCode"];
    if (typeof summary === "string") {
      totalLength += summary.length;
    }
    if (typeof reasonCode === "string") {
      totalLength += reasonCode.length;
    }
  }

  const avgLength = totalLength / signals.length;
  return Math.min(1, avgLength / 100);
}

function assessLabelReliability(signal: FeedbackSignal): number {
  if (signal.source === "user" || signal.source === "hitl") {
    return 1;
  }
  if (signal.source === "validation") {
    return 0.8;
  }
  if (signal.category === "correction") {
    return 0.75;
  }
  if (signal.category === "failure" || signal.category === "timeout") {
    return 0.7;
  }
  return 0.5;
}

export class FeedbackQualityGrader {
  private readonly options: Required<GradingOptions>;

  constructor(options: GradingOptions = {}) {
    this.options = { ...DEFAULT_GRADING_OPTIONS, ...options };
  }

  public gradeSignals(signals: readonly FeedbackSignal[]): QualityGrade {
    if (signals.length === 0) {
      return {
        grade: "discard",
        score: { overall: 0, signalQuality: 0, diversityScore: 0, informationDensity: 0, labelReliability: 0 },
        reasons: ["No signals provided"],
      };
    }

    const reasons: string[] = [];
    let signalQualitySum = 0;
    let labelReliabilitySum = 0;

    for (const signal of signals) {
      const ageDays = (Date.now() - signal.timestamp) / (1000 * 60 * 60 * 24);
      if (ageDays > this.options.maxAgeDays) {
        reasons.push(`Signal ${signal.signalId} exceeds max age (${Math.round(ageDays)}d > ${this.options.maxAgeDays}d)`);
      }
      signalQualitySum += assessSignalQuality(signal);
      labelReliabilitySum += assessLabelReliability(signal);
    }

    const signalQuality = signalQualitySum / signals.length;
    const diversityScore = assessDiversity(signals);
    const informationDensity = assessInformationDensity(signals);
    const labelReliability = labelReliabilitySum / signals.length;

    const overall = signalQuality * 0.4 + diversityScore * 0.2 + informationDensity * 0.2 + labelReliability * 0.2;

    if (this.options.requireHumanSource && !signals.some((s) => s.source === "user" || s.source === "hitl")) {
      reasons.push("No human-generated feedback found");
    }

    if (signalQuality < this.options.minSignalQuality) {
      reasons.push(`Signal quality below threshold (${signalQuality.toFixed(2)} < ${this.options.minSignalQuality})`);
    }

    let grade: QualityGrade["grade"];
    if (overall < this.options.minOverallScore) {
      grade = "discard";
      reasons.push(`Overall score below threshold (${overall.toFixed(2)} < ${this.options.minOverallScore})`);
    } else if (overall >= 0.8) {
      grade = "high";
    } else if (overall >= 0.6) {
      grade = "medium";
    } else if (overall >= this.options.minOverallScore) {
      grade = "low";
    } else {
      grade = "discard";
    }

    return {
      grade,
      score: {
        overall,
        signalQuality,
        diversityScore,
        informationDensity,
        labelReliability,
      },
      reasons: reasons.length > 0 ? reasons : ["Passed quality threshold"],
    };
  }

  public gradeLearningSignals(signals: readonly LearningSignal[]): QualityGrade {
    if (signals.length === 0) {
      return {
        grade: "discard",
        score: { overall: 0, signalQuality: 0, diversityScore: 0, informationDensity: 0, labelReliability: 0 },
        reasons: ["No learning signals provided"],
      };
    }

    const feedbackSignals = signals.flatMap((sig) => {
      const result: FeedbackSignal[] = [];
      for (const id of sig.sourceSignalIds) {
        result.push({
          signalId: id,
          taskId: sig.taskId,
          source: "execution",
          category: sig.learningType === "failure_pattern" ? "failure"
            : sig.learningType === "user_correction" ? "correction"
            : sig.learningType === "recovery_playbook" ? "partial"
            : "success",
          severity: "error",
          payload: { reasonCode: sig.learningType },
          stepOutputRefs: sig.evidenceRefs,
          timestamp: sig.generatedAt,
          trustScore: {
            overallScore: 0.5,
            sourceReliability: 0.6,
            historicalAccuracy: 0.5,
            adversarialRisk: "low" as const,
            passedSanityCheck: false,
          },
          evidenceRefs: sig.evidenceRefs,
        });
      }
      return result;
    });

    return this.gradeSignals(feedbackSignals);
  }

  public filterByGrade(
    signals: readonly FeedbackSignal[],
    minGrade: QualityGrade["grade"] = "medium",
  ): FeedbackSignal[] {
    const grade = this.gradeSignals(signals);
    if (grade.score.overall < this.gradeToScore(minGrade)) {
      return [];
    }
    return [...signals];
  }

  private gradeToScore(grade: QualityGrade["grade"]): number {
    switch (grade) {
      case "high":
        return 0.8;
      case "medium":
        return 0.6;
      case "low":
        return this.options.minOverallScore;
      default:
        return 0;
    }
  }
}