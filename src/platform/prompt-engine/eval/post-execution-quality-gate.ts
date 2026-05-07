import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";

export interface PostExecutionQualityGateDecision {
  accepted: boolean;
  releaseStage: "released" | "repair" | "approval" | "blocked";
  reasonCodes: string[];
}

export interface PreReleaseQualityGateRequest {
  readonly qualityScore: number;
  readonly minimumQualityScore: number;
  readonly regressionDetected?: boolean;
  readonly blockingIncidentCount?: number;
  readonly criticalCaseCount?: number;
  readonly criticalCasePassedCount?: number;
  readonly requiredEvidenceRefs?: readonly string[];
  readonly presentEvidenceRefs?: readonly string[];
}

export interface PreReleaseQualityGateDecision {
  promotable: boolean;
  releaseStage: "promote" | "hold" | "blocked";
  reasonCodes: string[];
}

export class PostExecutionQualityGate {
  /**
   * Evaluates critical_case_pass==100% as a hard release gate per §21.5.
   * If critical cases exist and any fail (pass rate < 1), the release is blocked.
   */
  public decide(evaluation: ExecutionOutcomeEvaluation, context?: {
    criticalCaseCount?: number;
    criticalCasePassedCount?: number;
  }): PostExecutionQualityGateDecision {
    // §21.5: Hard gate - if critical cases exist and not all passed, block release
    if (context?.criticalCaseCount != null && context.criticalCaseCount > 0) {
      const criticalPassRate = (context.criticalCasePassedCount ?? 0) / context.criticalCaseCount;
      if (criticalPassRate < 1) {
        return {
          accepted: false,
          releaseStage: "blocked",
          reasonCodes: [`quality.critical_case_failed:${criticalPassRate}`],
        };
      }
    }

    if (evaluation.nextAction === "complete" && evaluation.passed) {
      return {
        accepted: true,
        releaseStage: "released",
        reasonCodes: ["quality.accepted"],
      };
    }
    if (evaluation.nextAction === "approve") {
      return {
        accepted: false,
        releaseStage: "approval",
        reasonCodes: ["quality.approval_required"],
      };
    }
    if (evaluation.nextAction === "retry" || evaluation.nextAction === "replan") {
      return {
        accepted: false,
        releaseStage: "repair",
        reasonCodes: ["quality.repair_required"],
      };
    }
    return {
      accepted: false,
      releaseStage: "blocked",
      reasonCodes: ["quality.blocked"],
    };
  }
}

export class PreReleaseQualityGate {
  public decide(request: PreReleaseQualityGateRequest): PreReleaseQualityGateDecision {
    if (request.regressionDetected === true) {
      return {
        promotable: false,
        releaseStage: "blocked",
        reasonCodes: ["quality.pre_release_regression_detected"],
      };
    }

    if ((request.blockingIncidentCount ?? 0) > 0) {
      return {
        promotable: false,
        releaseStage: "blocked",
        reasonCodes: ["quality.pre_release_blocking_incident"],
      };
    }

    if ((request.criticalCaseCount ?? 0) > 0) {
      const criticalPassRate = (request.criticalCasePassedCount ?? 0) / request.criticalCaseCount!;
      if (criticalPassRate < 1) {
        return {
          promotable: false,
          releaseStage: "blocked",
          reasonCodes: [`quality.pre_release_critical_case_failed:${criticalPassRate}`],
        };
      }
    }

    const missingEvidenceRefs = (request.requiredEvidenceRefs ?? []).filter(
      (ref) => !(request.presentEvidenceRefs ?? []).includes(ref),
    );
    if (missingEvidenceRefs.length > 0) {
      return {
        promotable: false,
        releaseStage: "hold",
        reasonCodes: missingEvidenceRefs.map((ref) => `quality.pre_release_missing_evidence:${ref}`),
      };
    }

    if (request.qualityScore < request.minimumQualityScore) {
      return {
        promotable: false,
        releaseStage: "hold",
        reasonCodes: [`quality.pre_release_threshold_not_met:${request.qualityScore}`],
      };
    }

    return {
      promotable: true,
      releaseStage: "promote",
      reasonCodes: ["quality.pre_release_approved"],
    };
  }
}
