import {
  createTaskSituationRef,
  parseTaskSituation,
  type AssessmentComplexity,
  type TaskSituation,
  type UnifiedAssessment,
} from "./types/index.js";
import type { ConstraintPack } from "../harness/index.js";

/**
 * EffectivePolicySnapshot - policy state produced by the policy engine.
 * Captures the effective set of policies resolved from ConstraintPack and domain defaults.
 * NOTE: This is an integration interface — the authoritative definition should live in the policy plane.
 * If the policy plane defines a canonical type, this interface should be removed and replaced with an import.
 */
export interface EffectivePolicySnapshot {
  readonly policyIds: readonly string[];
  readonly appliedPolicies: readonly {
    readonly policyId: string;
    readonly version: string;
    readonly constraints: readonly string[];
  }[];
  readonly autonomyLevel: ConstraintPack["autonomyMode"];
  readonly approvalMode: ConstraintPack["approvalMode"];
}

/**
 * RiskAssessment - assessment of task risk factors produced by the Assess stage.
 * This is consumed by downstream stages (Plan, Execute) for routing and approval decisions.
 */
export interface RiskAssessment {
  readonly level: "low" | "medium" | "high" | "critical";
  readonly score: number; // 0.0 - 1.0
  readonly factors: readonly string[];
  readonly policyConstraintRefs: readonly string[];
  readonly escalated: boolean;
}

export interface AssessmentServiceOptions {
  highRiskTools?: readonly string[];
}

export class AssessmentService {
  private readonly highRiskTools: ReadonlySet<string>;

  public constructor(options: AssessmentServiceOptions = {}) {
    this.highRiskTools = new Set(options.highRiskTools ?? ["apply_patch", "shell", "deploy"]);
  }

  /**
   * Runs the Assess stage of OAPEFLIR.
   *
   * @param situation - The parsed task situation from the Observe stage
   * @param constraintPack - ConstraintPack consumed by the Assess stage for policy-aware risk assessment
   * @param effectivePolicy - EffectivePolicySnapshot consumed by the Assess stage for policy-informed routing
   * @returns UnifiedAssessment and standalone RiskAssessment produced by the Assess stage
   */
  public assess(
    taskSituation: TaskSituation,
    constraintPack?: ConstraintPack,
    effectivePolicy?: EffectivePolicySnapshot,
  ): { assessment: UnifiedAssessment; riskAssessment: RiskAssessment } {
    // NOTE: taskSituation is already a TaskSituation from the Observe stage.
    // If re-parsing is needed for validation, use parseTaskSituation(taskSituation) here.
    const situation = taskSituation;
    const blockerSeverities = situation.blockers.map((blocker) => blocker.severity);
    const riskFactors: string[] = [];

    // R5-6: Consume ConstraintPack for policy-aware risk evaluation
    if (constraintPack?.risk_policy) {
      // ConstraintPack risk_policy provides maxRiskScore and escalationThreshold
      const { maxRiskScore, escalationThreshold } = constraintPack.risk_policy;
      if (maxRiskScore < 0.5) {
        riskFactors.push("constraint_pack_low_max_risk");
      }
      // NOTE: ConstraintPack.risk_policy is advisory — actual risk is computed from situation factors below.
      // The escalation threshold from ConstraintPack could be used for additional risk escalation.
      void escalationThreshold; // Available for future threshold-based escalation
    }

    // R5-6: Consume EffectivePolicySnapshot for policy-informed routing
    if (effectivePolicy) {
      // If autonomy level is "suggestion", add a risk factor to reflect reduced automation
      if (effectivePolicy.autonomyLevel === "suggestion") {
        riskFactors.push("policy_suggestion_mode");
      }
      // If any applied policy has constraint flags, factor them in
      for (const policy of effectivePolicy.appliedPolicies) {
        if (policy.constraints.some((c) => c.includes("high_risk") || c.includes("critical"))) {
          riskFactors.push(`policy_constraint:${policy.policyId}`);
        }
      }
    }

    if (blockerSeverities.includes("critical")) {
      riskFactors.push("critical_blocker");
    }
    if (blockerSeverities.includes("high")) {
      riskFactors.push("high_blocker");
    }
    if (situation.userIntent.confidence < 0.65) {
      riskFactors.push("low_intent_confidence");
    }
    if (situation.environmentContext.availableTools.some((tool) => this.highRiskTools.has(tool))) {
      riskFactors.push("high_risk_tooling");
    }
    if ((situation.metrics.approvalPending ?? 0) > 0) {
      riskFactors.push("approval_pending");
    }

    const risk =
      riskFactors.includes("critical_blocker")
        ? "critical"
        : riskFactors.includes("high_blocker") || riskFactors.includes("approval_pending")
          ? "high"
          : riskFactors.length > 0
            ? "medium"
            : "low";

    const complexity = this.deriveComplexity(situation, risk);
    const approvalRequired = risk === "high" || risk === "critical";
    const workflow = complexity === "trivial" || complexity === "simple" ? "single-step" : "multi-step";

    // R5-6: Produce RiskAssessment as explicit output
    const riskScore = riskFactors.length > 0
      ? (risk === "critical" ? 0.95 : risk === "high" ? 0.75 : risk === "medium" ? 0.45 : 0.15)
      : 0.1;

    const riskAssessment: RiskAssessment = {
      level: risk,
      score: riskScore,
      factors: riskFactors,
      // R5-6: Link RiskAssessment to policy constraints for traceability
      policyConstraintRefs: constraintPack?.policyIds ?? [],
      escalated: risk === "critical" || risk === "high",
    };

    const assessment: UnifiedAssessment = {
      taskId: situation.taskId,
      timestamp: Date.now(),
      situationRef: createTaskSituationRef(situation),
      phase: "pre-execution",
      complexity,
      risk,
      riskAssessment: {
        level: risk,
        factors: riskFactors,
      },
      routingDecision: {
        division: "coding",
        workflow,
        rationale: `complexity=${complexity};risk=${risk};files=${situation.fileRefs.length}`,
      },
      resourceAllocation: {
        modelClass: complexity === "critical" || complexity === "complex" ? "large" : complexity === "moderate" ? "medium" : "small",
        maxTokens: complexity === "critical" ? 12000 : complexity === "complex" ? 8000 : complexity === "moderate" ? 5000 : 3000,
        timeoutMs: complexity === "critical" ? 180000 : complexity === "complex" ? 120000 : 60000,
      },
      approvalPolicy: {
        required: approvalRequired,
        level: approvalRequired ? (risk === "critical" ? "admin" : "user") : "none",
      },
      executionMode: risk === "critical" ? "manual" : risk === "high" ? "supervised" : "auto",
      suggestedActions: [
        ...(situation.blockers.map((blocker) => `resolve:${blocker.description}`)),
        ...(approvalRequired ? ["request_approval"] : []),
        ...(complexity !== "trivial" ? ["produce_explicit_plan"] : []),
      ],
    };

    return { assessment, riskAssessment };
  }

  private deriveComplexity(situation: TaskSituation, risk: UnifiedAssessment["risk"]): AssessmentComplexity {
    const fileCount = Math.max(situation.fileRefs.length, situation.codebaseSnapshot.fileCount);
    const blockerCount = situation.blockers.length;
    const memoryCount = situation.relevantMemory.length;

    if (risk === "critical" || fileCount >= 20 || blockerCount >= 3) {
      return "critical";
    }
    if (risk === "high" || fileCount >= 10 || blockerCount >= 2) {
      return "complex";
    }
    if (fileCount >= 4 || memoryCount > 0 || blockerCount >= 1) {
      return "moderate";
    }
    if (fileCount >= 2) {
      return "simple";
    }
    return "trivial";
  }
}
