import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { analyzeFeedbackSignals, type FeedbackAnalysisSummary } from "./analyzer/index.js";
import { FeedbackCollector, type FeedbackCollectorInput } from "./collector/feedback-collector.js";
import type { FeedbackBatch, FeedbackSignal, LearningSignal } from "./collector/index.js";
import {
  summarizeImprovementTracking,
  type ImprovementTrackingRecord,
} from "./improvement-tracker/index.js";

export interface ImprovementCandidate {
  readonly candidateId: string;
  readonly candidateType:
    | "prompt_tuning"
    | "workflow_patch"
    | "policy_adjustment"
    | "playbook_update"
    | "model_retraining"
    | "data_augmentation";
  readonly sourceSignalIds: readonly string[];
  readonly candidate_type?: ImprovementCandidate["candidateType"];
  readonly proposedChange: {
    readonly summary: string;
    readonly targetSurface: "prompt" | "workflow" | "policy" | "playbook" | "model" | "dataset";
  };
  readonly riskAssessment: "low" | "medium" | "high";
  readonly reviewStatus: "proposed" | "reviewing" | "approved" | "rejected" | "released";
}

export interface ImprovementReviewDecision {
  readonly candidateId: string;
  readonly decision: "approved" | "rejected";
  readonly reviewer: string;
  readonly reviewedAt: string;
  readonly rolloutGatePassed: boolean;
  readonly policyGatePassed: boolean;
}

export interface FeedbackLoopSnapshot {
  readonly generatedAt: string;
  readonly analysis: FeedbackAnalysisSummary;
  readonly trackingSummary: Readonly<Record<string, number>>;
  readonly candidateCount: number;
}

export class FeedbackImprovementService {
  private readonly collector = new FeedbackCollector();
  private readonly records = new Map<string, ImprovementTrackingRecord>();
  private readonly candidates = new Map<string, ImprovementCandidate>();

  public ingest(input: FeedbackCollectorInput): {
    feedback: FeedbackBatch;
    learningSignals: LearningSignal[];
    candidates: ImprovementCandidate[];
  } {
    const feedback = this.collector.collect(input);
    const learningSignals = this.collector.toLearningSignals(feedback);
    const candidates = learningSignals.map((signal) => this.createCandidate(signal));
    return { feedback, learningSignals, candidates };
  }

  public createCandidate(signal: LearningSignal): ImprovementCandidate {
    if (signal.sourceSignalIds.length === 0) {
      throw new Error(`feedback_improvement.missing_source_signal:${signal.learningSignalId}`);
    }
    const candidate: ImprovementCandidate = {
      candidateId: newId("improvement_candidate"),
      candidateType: this.mapCandidateType(signal.learningType),
      candidate_type: this.mapCandidateType(signal.learningType),
      sourceSignalIds: signal.sourceSignalIds,
      proposedChange: {
        summary: signal.valueSummary,
        targetSurface: this.mapTargetSurface(signal.learningType),
      },
      riskAssessment: signal.confidence >= 0.85 ? "low" : signal.confidence >= 0.6 ? "medium" : "high",
      reviewStatus: "proposed",
    };
    this.candidates.set(candidate.candidateId, candidate);
    this.records.set(candidate.candidateId, {
      candidateId: candidate.candidateId,
      sourceSignalIds: [...candidate.sourceSignalIds],
      status: "proposed",
      owner: "feedback_loop",
    });
    return candidate;
  }

  public review(
    candidateId: string,
    reviewer: string,
    decision: "approved" | "rejected",
    options: {
      readonly rolloutGatePassed: boolean;
      readonly policyGatePassed: boolean;
      readonly reviewedAt?: string;
    },
  ): ImprovementReviewDecision {
    const candidate = this.requireCandidate(candidateId);
    const allowed = decision === "approved" && options.rolloutGatePassed && options.policyGatePassed;
    const nextStatus = allowed ? "approved" : "rejected";
    this.candidates.set(candidateId, {
      ...candidate,
      reviewStatus: nextStatus,
    });
    this.records.set(candidateId, {
      candidateId,
      sourceSignalIds: [...candidate.sourceSignalIds],
      status: nextStatus,
      owner: reviewer,
    });
    return {
      candidateId,
      decision: nextStatus === "approved" ? "approved" : "rejected",
      reviewer,
      reviewedAt: options.reviewedAt ?? nowIso(),
      rolloutGatePassed: options.rolloutGatePassed,
      policyGatePassed: options.policyGatePassed,
    };
  }

  public release(candidateId: string, owner: string): ImprovementCandidate {
    const candidate = this.requireCandidate(candidateId);
    if (candidate.reviewStatus !== "approved") {
      throw new Error(`feedback_improvement.release_requires_approval:${candidateId}`);
    }
    const released: ImprovementCandidate = {
      ...candidate,
      reviewStatus: "released",
    };
    this.candidates.set(candidateId, released);
    this.records.set(candidateId, {
      candidateId,
      sourceSignalIds: [...candidate.sourceSignalIds],
      status: "released",
      owner,
    });
    return released;
  }

  public buildSnapshot(signals: readonly FeedbackSignal[], generatedAt = nowIso()): FeedbackLoopSnapshot {
    return {
      generatedAt,
      analysis: analyzeFeedbackSignals(signals),
      trackingSummary: summarizeImprovementTracking([...this.records.values()]),
      candidateCount: this.candidates.size,
    };
  }

  public listCandidates(): ImprovementCandidate[] {
    return [...this.candidates.values()];
  }

  private mapCandidateType(signalType: LearningSignal["learningType"]): ImprovementCandidate["candidateType"] {
    switch (signalType) {
      case "failure_pattern":
        return "workflow_patch";
      case "user_correction":
        return "prompt_tuning";
      case "model_retraining":
        return "model_retraining";
      case "dataset_gap":
        return "data_augmentation";
      case "recovery_playbook":
      default:
        return "playbook_update";
    }
  }

  private mapTargetSurface(signalType: LearningSignal["learningType"]): ImprovementCandidate["proposedChange"]["targetSurface"] {
    switch (signalType) {
      case "failure_pattern":
        return "workflow";
      case "user_correction":
        return "prompt";
      case "model_retraining":
        return "model";
      case "dataset_gap":
        return "dataset";
      case "recovery_playbook":
      default:
        return "playbook";
    }
  }

  private requireCandidate(candidateId: string): ImprovementCandidate {
    const candidate = this.candidates.get(candidateId);
    if (candidate == null) {
      throw new Error(`feedback_improvement.candidate_not_found:${candidateId}`);
    }
    return candidate;
  }
}
