import {
  createTaskSituationRef,
  parseTaskSituation,
  type AssessmentComplexity,
  type TaskSituation,
  type UnifiedAssessment,
} from "./types/index.js";
import type { ConstraintPack } from "../harness/index.js";

export interface AssessmentServiceOptions {
  highRiskTools?: readonly string[];
}

export interface EffectivePolicySnapshot {
  readonly snapshotId: string;
  readonly requiredApprovalLevel?: "none" | "user" | "admin";
  readonly blockedTools?: readonly string[];
  readonly forcedExecutionMode?: UnifiedAssessment["executionMode"];
}

export interface CanonicalRiskAssessment {
  readonly level: UnifiedAssessment["risk"];
  readonly factors: readonly string[];
}

export interface AssessmentInput {
  readonly taskSituation: TaskSituation;
  readonly constraintPack?: ConstraintPack;
  readonly effectivePolicySnapshot?: EffectivePolicySnapshot;
  readonly inheritedRiskAssessment?: CanonicalRiskAssessment;
}

export class AssessmentService {
  private readonly highRiskTools: ReadonlySet<string>;

  public constructor(options: AssessmentServiceOptions = {}) {
    this.highRiskTools = new Set(options.highRiskTools ?? ["apply_patch", "shell", "deploy"]);
  }

  public assess(input: TaskSituation | AssessmentInput): UnifiedAssessment {
    const assessmentInput = this.normalizeInput(input);
    const situation = parseTaskSituation(assessmentInput.taskSituation);
    const blockerSeverities = situation.blockers.map((blocker) => blocker.severity);
    const riskFactors: string[] = [];
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
    if (assessmentInput.constraintPack != null) {
      riskFactors.push(...this.collectConstraintRiskFactors(assessmentInput.constraintPack));
    }
    if (assessmentInput.effectivePolicySnapshot?.blockedTools?.length) {
      const blockedTools = new Set(assessmentInput.effectivePolicySnapshot.blockedTools);
      const blockedAvailableTools = situation.environmentContext.availableTools.filter((tool) => blockedTools.has(tool));
      if (blockedAvailableTools.length > 0) {
        riskFactors.push(`blocked_tools:${blockedAvailableTools.join(",")}`);
      }
    }
    if (assessmentInput.inheritedRiskAssessment != null) {
      riskFactors.push(
        ...assessmentInput.inheritedRiskAssessment.factors.map((factor) => `inherited:${factor}`),
      );
    }

    const risk =
      riskFactors.includes("critical_blocker")
      || riskFactors.includes("approval_mode_required")
        ? "critical"
      : riskFactors.includes("high_blocker") || riskFactors.includes("approval_pending")
        || riskFactors.includes("approval_mode_supervised")
          ? "high"
        : riskFactors.length > 0
          ? "medium"
          : "low";

    const complexity = this.deriveComplexity(situation, risk);
    const approvalRequired = this.resolveApprovalRequirement(risk, assessmentInput.effectivePolicySnapshot);
    const workflow = complexity === "trivial" || complexity === "simple" ? "single-step" : "multi-step";
    const executionMode = assessmentInput.effectivePolicySnapshot?.forcedExecutionMode
      ?? (risk === "critical" ? "manual" : risk === "high" ? "supervised" : "auto");

    return {
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
        // Division must come from actual domainId when available
        division: situation.domainId ?? "general",
        workflow,
        rationale: [
          `complexity=${complexity}`,
          `risk=${risk}`,
          `files=${situation.fileRefs.length}`,
          ...(assessmentInput.constraintPack == null ? [] : [`constraintPack=${assessmentInput.constraintPack.policyIds.join(",")}`]),
          ...(assessmentInput.effectivePolicySnapshot == null ? [] : [`policySnapshot=${assessmentInput.effectivePolicySnapshot.snapshotId}`]),
        ].join(";"),
      },
      resourceAllocation: {
        modelClass: complexity === "critical" || complexity === "complex" ? "large" : complexity === "moderate" ? "medium" : "small",
        maxTokens: complexity === "critical" ? 12000 : complexity === "complex" ? 8000 : complexity === "moderate" ? 5000 : 3000,
        timeoutMs: complexity === "critical" ? 180000 : complexity === "complex" ? 120000 : 60000,
      },
      approvalPolicy: {
        required: approvalRequired,
        level: approvalRequired
          ? (assessmentInput.effectivePolicySnapshot?.requiredApprovalLevel
            ?? (risk === "critical" ? "admin" : "user"))
          : "none",
      },
      executionMode,
      suggestedActions: [
        ...(situation.blockers.map((blocker) => `resolve:${blocker.description}`)),
        ...(approvalRequired ? ["request_approval"] : []),
        ...(complexity !== "trivial" ? ["produce_explicit_plan"] : []),
      ],
    };
  }

  private deriveComplexity(situation: TaskSituation, risk: UnifiedAssessment["risk"]): AssessmentComplexity {
    // §32 EvaluationGate numerical scoring model
    const fileCount = Math.max(situation.fileRefs.length, situation.codebaseSnapshot.fileCount);
    const blockerCount = situation.blockers.length;
    const memoryCount = situation.relevantMemory.length;
    const criticalBlockers = situation.blockers.filter((b) => b.severity === "critical").length;
    const highBlockers = situation.blockers.filter((b) => b.severity === "high").length;
    const otherBlockers = blockerCount - criticalBlockers - highBlockers;

    // Numerical scoring: weighted sum of complexity factors (0-100 scale)
    const fileScore = Math.min(fileCount * 0.5, 25); // 0.5 points per file, max 25
    const blockerScore = criticalBlockers * 8 + highBlockers * 4 + otherBlockers * 2; // weighted by severity, max ~24
    const memoryScore = Math.min(memoryCount * 0.5, 10); // 0.5 points per memory item, max 10
    const riskScore = risk === "critical" ? 30 : risk === "high" ? 20 : risk === "medium" ? 10 : 0;

    const totalScore = fileScore + blockerScore + memoryScore + riskScore;

    // Score thresholds mapped to complexity levels (max possible ~89)
    if (totalScore >= 50) return "critical";
    if (totalScore >= 35) return "complex";
    if (totalScore >= 20) return "moderate";
    if (totalScore >= 8) return "simple";
    return "trivial";
  }

  private normalizeInput(input: TaskSituation | AssessmentInput): AssessmentInput {
    return "taskSituation" in input ? input : { taskSituation: input };
  }

  private collectConstraintRiskFactors(constraintPack: ConstraintPack): string[] {
    const factors: string[] = [];
    if (constraintPack.approvalMode === "required") {
      factors.push("approval_mode_required");
    } else if (constraintPack.approvalMode === "supervised") {
      factors.push("approval_mode_supervised");
    }
    const budgetEnvelope = constraintPack.budgetEnvelope ?? constraintPack.budget_envelope ?? constraintPack.budget;
    if (budgetEnvelope != null && budgetEnvelope.maxSteps <= 2) {
      factors.push("tight_budget_envelope");
    }
    if (constraintPack.autonomyMode === "suggestion") {
      factors.push("autonomy_mode_suggestion");
    }
    return factors;
  }

  private resolveApprovalRequirement(
    risk: UnifiedAssessment["risk"],
    snapshot?: EffectivePolicySnapshot,
  ): boolean {
    if (snapshot?.requiredApprovalLevel && snapshot.requiredApprovalLevel !== "none") {
      return true;
    }
    return risk === "high" || risk === "critical";
  }
}
