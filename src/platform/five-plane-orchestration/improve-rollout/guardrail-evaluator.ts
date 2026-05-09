import type { ImprovementCandidate } from "./improvement-candidate-registry.js";
import type { RolloutMetrics } from "./auto-rollback-service.js";
import type { StrategyVersion } from "./strategy-versioning.js";
import type { RolloutLevel } from "../oapeflir/types/rollout-record.js";

export interface GuardrailEvaluation {
  allowed: boolean;
  reasonCodes: string[];
}

export interface LegacyGuardrailResult {
  name: string;
  status: "pass" | "fail";
  reasonCode: string | null;
}

export interface LegacyGuardrailEvaluation {
  passed: boolean;
  blockingIssues: string[];
  guardrailResults: LegacyGuardrailResult[];
}

export class GuardrailEvaluator {
  public evaluate(candidate: ImprovementCandidate, strategyVersion: StrategyVersion): GuardrailEvaluation;
  public evaluate(stage: string, metrics: RolloutMetrics): LegacyGuardrailEvaluation;
  public evaluate(
    candidateOrStage: ImprovementCandidate | string,
    strategyOrMetrics: StrategyVersion | RolloutMetrics,
  ): GuardrailEvaluation | LegacyGuardrailEvaluation {
    if (typeof candidateOrStage === "string") {
      return this.evaluateLegacyMetrics(strategyOrMetrics as RolloutMetrics);
    }
    const candidate = candidateOrStage;
    const strategyVersion = strategyOrMetrics as StrategyVersion;
    const reasonCodes: string[] = [];

    if (candidate.sourceSignalRefs.length === 0) {
      reasonCodes.push("improvement.guardrail_missing_evidence");
    }
    if (candidate.sourceLearningObjectIds.length === 0) {
      reasonCodes.push("improvement.guardrail_missing_learning_object");
    }
    if (candidate.learningObjectId.length === 0) {
      reasonCodes.push("improvement.guardrail_missing_primary_learning_object");
    }
    if (strategyVersion.sourceLearningObjectIds.length === 0) {
      reasonCodes.push("improvement.guardrail_unlinked_strategy");
    }
    if (strategyVersion.releaseLevel !== "off" && candidate.status !== "approved") {
      reasonCodes.push("improvement.guardrail_requires_approval");
    }
    for (const guardrail of candidate.guardrails) {
      if (rolloutLevelRank(strategyVersion.releaseLevel) < rolloutLevelRank(guardrail.requiredLevel)) {
        reasonCodes.push(`improvement.guardrail_level_blocked:${guardrail.guardrailId}`);
      }
    }

    return {
      allowed: reasonCodes.length === 0,
      reasonCodes,
    };
  }

  private evaluateLegacyMetrics(metrics: RolloutMetrics): LegacyGuardrailEvaluation {
    const guardrailResults: LegacyGuardrailResult[] = [];
    const blockingIssues: string[] = [];

    const add = (name: string, passed: boolean, reasonCode: string | null): void => {
      guardrailResults.push({ name, status: passed ? "pass" : "fail", reasonCode });
      if (!passed && reasonCode != null) {
        blockingIssues.push(reasonCode);
      }
    };

    add(
      "minimum_sample",
      metrics.requestCount >= 20,
      metrics.requestCount >= 20 ? null : "insufficient sample count",
    );
    add(
      "minimum_window",
      (metrics.observationWindowMs ?? 60_000) >= 60_000,
      (metrics.observationWindowMs ?? 60_000) >= 60_000 ? null : "insufficient observation window",
    );
    add(
      "failure_rate",
      metrics.failureRate <= 0.05,
      metrics.failureRate <= 0.05 ? null : "failure rate exceeded",
    );
    const latencyMultiplier = metrics.p99LatencyMs / Math.max(metrics.baselineP99LatencyMs, 1);
    add(
      "latency",
      latencyMultiplier <= 2,
      latencyMultiplier <= 2 ? null : "latency multiplier exceeded",
    );

    return {
      passed: blockingIssues.length === 0,
      blockingIssues,
      guardrailResults,
    };
  }
}

function rolloutLevelRank(level: RolloutLevel): number {
  switch (level) {
    case "off":
      return 0;
    case "evaluate_0":
      return 1;
    case "canary_5":
      return 2;
    case "partial_25":
      return 3;
    case "stable_75":
      return 4;
    case "stable_100":
      return 5;
  }
}
