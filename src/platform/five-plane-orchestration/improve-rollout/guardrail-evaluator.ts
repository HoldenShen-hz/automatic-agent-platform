import type { ImprovementCandidate } from "./improvement-candidate-registry.js";
import type { RolloutMetrics } from "./auto-rollback-service.js";
import type { StrategyVersion } from "./strategy-versioning.js";

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
    if (strategyVersion.sourceLearningObjectIds.length === 0) {
      reasonCodes.push("improvement.guardrail_unlinked_strategy");
    }
    if (
      strategyVersion.releaseLevel === "evaluate_0"
      && candidate.status !== "approved"
      && candidate.status !== "shadow_running"
      && candidate.status !== "evaluating"
    ) {
      reasonCodes.push("improvement.guardrail_evaluation_requires_approval");
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
