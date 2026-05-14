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
  readonly policyIds?: readonly string[];
  readonly blockedTools?: readonly string[];
  readonly appliedPolicies?: readonly {
    readonly policyId: string;
    readonly version: string;
    readonly constraints: readonly string[];
  }[];
  readonly autonomyLevel?: ConstraintPack["autonomyMode"];
  readonly approvalMode?: ConstraintPack["approvalMode"];
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

export interface ComplexityThresholds {
  readonly fileCount: {
    readonly critical: number; // default 20
    readonly high: number;      // default 10
    readonly moderate: number;  // default 4
    readonly simple: number;   // default 2
  };
  readonly blockerCount: {
    readonly critical: number; // default 3
    readonly high: number;     // default 2
    readonly moderate: number; // default 1
  };
}

export interface AssessmentServiceOptions {
  highRiskTools?: readonly string[];
  complexityThresholds?: Partial<ComplexityThresholds>;
}

interface ComplexityScoreAssessment {
  readonly level: AssessmentComplexity;
  readonly score: number;
}

export type AssessmentServiceResult = Omit<UnifiedAssessment, "riskAssessment"> & {
  assessment: UnifiedAssessment;
  riskAssessment: UnifiedAssessment["riskAssessment"] & RiskAssessment;
};

interface WrappedAssessmentInput {
  readonly taskSituation: TaskSituation;
  readonly constraintPack?: ConstraintPack;
  readonly effectivePolicySnapshot?: EffectivePolicySnapshot;
  readonly effectivePolicy?: EffectivePolicySnapshot;
  readonly inheritedRiskAssessment?: { readonly level?: RiskAssessment["level"]; readonly factors?: readonly string[] };
}

function isWrappedAssessmentInput(input: TaskSituation | WrappedAssessmentInput): input is WrappedAssessmentInput {
  return typeof input === "object" && input != null && "taskSituation" in input;
}

export class AssessmentService {
  private readonly highRiskTools: ReadonlySet<string>;
  private readonly fileCountThresholds: { critical: number; high: number; moderate: number; simple: number };
  private readonly blockerCountThresholds: { critical: number; high: number; moderate: number };

  public constructor(options: AssessmentServiceOptions = {}) {
    this.highRiskTools = new Set(options.highRiskTools ?? ["apply_patch", "shell", "deploy"]);

    const defaults: ComplexityThresholds = {
      fileCount: { critical: 20, high: 10, moderate: 4, simple: 2 },
      blockerCount: { critical: 3, high: 2, moderate: 1 },
    };
    const cfg = options.complexityThresholds ?? {} as Partial<ComplexityThresholds>;
    this.fileCountThresholds = {
      critical: cfg.fileCount?.critical ?? defaults.fileCount.critical,
      high: cfg.fileCount?.high ?? defaults.fileCount.high,
      moderate: cfg.fileCount?.moderate ?? defaults.fileCount.moderate,
      simple: cfg.fileCount?.simple ?? defaults.fileCount.simple,
    };
    this.blockerCountThresholds = {
      critical: cfg.blockerCount?.critical ?? defaults.blockerCount.critical,
      high: cfg.blockerCount?.high ?? defaults.blockerCount.high,
      moderate: cfg.blockerCount?.moderate ?? defaults.blockerCount.moderate,
    };
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
    taskSituation: TaskSituation | WrappedAssessmentInput,
    constraintPack?: ConstraintPack,
    effectivePolicy?: EffectivePolicySnapshot,
  ): AssessmentServiceResult {
    const wrappedInput = isWrappedAssessmentInput(taskSituation) ? taskSituation : null;
    if (wrappedInput != null) {
      constraintPack = wrappedInput.constraintPack ?? constraintPack;
      effectivePolicy = wrappedInput.effectivePolicySnapshot ?? wrappedInput.effectivePolicy ?? effectivePolicy;
    }
    // NOTE: taskSituation is already a TaskSituation from the Observe stage.
    // If re-parsing is needed for validation, use parseTaskSituation(taskSituation) here.
    const situation: TaskSituation = wrappedInput != null ? wrappedInput.taskSituation : taskSituation as TaskSituation;
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
    if (constraintPack?.approvalMode === "required") {
      riskFactors.push("approval_mode_required");
    } else if (constraintPack?.approvalMode === "supervised") {
      riskFactors.push("approval_mode_supervised");
    }

    // R5-6: Consume EffectivePolicySnapshot for policy-informed routing
    if (effectivePolicy) {
      // If autonomy level is "suggestion", add a risk factor to reflect reduced automation
      if (effectivePolicy.autonomyLevel === "suggestion") {
        riskFactors.push("policy_suggestion_mode");
      }
      // If any applied policy has constraint flags, factor them in
      for (const blockedTool of effectivePolicy.blockedTools ?? []) {
        if (situation.environmentContext.availableTools.includes(blockedTool)) {
          riskFactors.push(`blocked_tools:${blockedTool}`);
        }
      }
      for (const policy of effectivePolicy.appliedPolicies ?? []) {
        if (policy.constraints.some((c) => c.includes("high_risk") || c.includes("critical"))) {
          riskFactors.push(`policy_constraint:${policy.policyId}`);
        }
      }
    }
    for (const factor of wrappedInput?.inheritedRiskAssessment?.factors ?? []) {
      riskFactors.push(`inherited:${factor}`);
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

    // R31-10 fix: Compute initial complexity for risk factor determination
    // (budget feasibility check may add more risk factors below)
    const initialComplexityAssessment = this.scoreComplexity(situation, "medium", riskFactors);

    // R31-10 fix: Check budget feasibility — spec §11 requires worst-path budget analysis
    // If estimated worst-path cost exceeds budgetEnvelope, task is not feasible
    const budgetEnvelope = constraintPack?.budgetEnvelope ?? constraintPack?.budget;
    if (budgetEnvelope) {
      if (budgetEnvelope.maxSteps <= 1 || budgetEnvelope.maxCost <= 1) {
        riskFactors.push("tight_budget_envelope");
      }
      const estimatedCost = this.estimateWorstPathCost(situation, initialComplexityAssessment.score);
      if (estimatedCost > budgetEnvelope.maxCost) {
        riskFactors.push("budget_exceeds_feasibility_threshold");
      }
      const estimatedSteps = this.estimateWorstPathSteps(situation);
      if (estimatedSteps > budgetEnvelope.maxSteps) {
        riskFactors.push("steps_exceed_feasibility_threshold");
      }
      if ((situation.metrics.estimatedDurationMs ?? 0) > budgetEnvelope.maxDurationMs) {
        riskFactors.push("duration_exceeds_feasibility_threshold");
      }
    }

    const risk =
      riskFactors.includes("critical_blocker")
        ? "critical"
        : riskFactors.includes("high_blocker") || riskFactors.includes("approval_pending")
          ? "high"
          : riskFactors.length > 0
            ? "medium"
            : "low";

    const complexityAssessment = this.scoreComplexity(situation, risk, riskFactors);
    const complexity = complexityAssessment.level;
    const approvalRequired = risk === "high" || risk === "critical";
    const workflow = complexity === "trivial" || complexity === "simple" ? "single-step" : "multi-step";

    // R5-6: Produce RiskAssessment as explicit output
    const riskScore = riskFactors.length > 0
      ? (risk === "critical" ? 0.95 : risk === "high" ? 0.75 : risk === "medium" ? 0.45 : 0.15)
      : 0.1;

    // R9-17 fix: Derive division from task situation domain hints, not a fixed "coding" value.
    // Domain detection based on available tools, file types, and blockers
    const division = this.deriveDivision(situation);

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
        division,
        workflow,
        rationale: `complexity=${complexity};complexityScore=${complexityAssessment.score};risk=${risk};files=${situation.fileRefs.length}`,
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

    return {
      ...assessment,
      assessment,
      riskAssessment: {
        ...assessment.riskAssessment,
        ...riskAssessment,
        factors: [...riskAssessment.factors],
      },
    };
  }

  private scoreComplexity(
    situation: TaskSituation,
    risk: UnifiedAssessment["risk"],
    riskFactors: readonly string[],
  ): ComplexityScoreAssessment {
    const fileCount = Math.max(situation.fileRefs.length, situation.codebaseSnapshot.fileCount);
    const blockerCount = situation.blockers.length;
    const memoryCount = situation.relevantMemory.length;
    const blockerSeverityScore = situation.blockers.reduce((sum, blocker) => {
      switch (blocker.severity) {
        case "critical":
          return sum + 12;
        case "high":
          return sum + 7;
        case "medium":
          return sum + 4;
        default:
          return sum + 2;
      }
    }, 0);
    const fileScore =
      fileCount >= this.fileCountThresholds.critical
        ? 12
        : fileCount >= this.fileCountThresholds.high
          ? 8
          : fileCount >= this.fileCountThresholds.moderate
            ? 5
            : fileCount >= this.fileCountThresholds.simple
              ? 2
              : 0;
    const blockerCountScore =
      blockerCount >= this.blockerCountThresholds.critical
        ? 12
        : blockerCount >= this.blockerCountThresholds.high
          ? 8
          : blockerCount >= this.blockerCountThresholds.moderate
            ? 4
            : 0;
    const memoryScore = memoryCount >= 10 ? 4 : memoryCount >= 4 ? 2 : memoryCount > 0 ? 1 : 0;
    const riskScore =
      risk === "critical"
        ? 6
        : risk === "high"
          ? 4
          : risk === "medium"
            ? 2
            : 0;
    const uncertaintyScore = situation.userIntent.confidence < 0.65 ? 2 : 0;
    const approvalScore = riskFactors.includes("approval_pending") ? 1.5 : 0;
    const toolingScore = riskFactors.includes("high_risk_tooling") ? 1.5 : 0;
    const score = Number(
      (
        fileScore
        + Math.max(blockerSeverityScore, blockerCountScore)
        + memoryScore
        + riskScore
        + uncertaintyScore
        + approvalScore
        + toolingScore
      ).toFixed(2),
    );

    if (risk === "critical" || fileCount >= this.fileCountThresholds.critical || blockerCount >= this.blockerCountThresholds.critical) {
      return { level: "critical", score };
    }
    if (risk === "high" || fileCount >= this.fileCountThresholds.high || blockerCount >= this.blockerCountThresholds.high) {
      return { level: "complex", score };
    }
    if (memoryCount > 0 || fileCount >= this.fileCountThresholds.moderate || blockerCount >= this.blockerCountThresholds.moderate) {
      return { level: "moderate", score };
    }
    if (score >= 2) {
      return { level: "simple", score };
    }
    return { level: "trivial", score };
  }

  /**
   * R31-10 fix: Estimates worst-path cost for budget feasibility analysis.
   * Uses complexity score, file count, and blocker severity to estimate worst-case cost.
   * This implements spec §11's worst-path budget analysis requirement.
   */
  private estimateWorstPathCost(situation: TaskSituation, complexityScore: number): number {
    const fileCount = Math.max(situation.fileRefs.length, situation.codebaseSnapshot.fileCount);
    const blockerCost = situation.blockers.reduce((sum, blocker) => {
      switch (blocker.severity) {
        case "critical": return sum + 500;
        case "high": return sum + 300;
        case "medium": return sum + 150;
        default: return sum + 50;
      }
    }, 0);
    // Base cost from complexity score (0-12 scale -> 0-1200 cost range)
    const baseCost = complexityScore * 100;
    // File handling overhead
    const fileCost = fileCount * 10;
    // Estimated max cost: base + blockers + file overhead, with a multiplier for worst-case
    return baseCost + blockerCost + fileCost + 200; // +200 buffer for execution variance
  }

  /**
   * R31-10 fix: Estimates worst-path step count for budget feasibility analysis.
   * Uses complexity level and blocker count to estimate maximum steps needed.
   * This implements spec §11's worst-path budget analysis requirement.
   */
  private estimateWorstPathSteps(situation: TaskSituation): number {
    const blockerCount = situation.blockers.length;
    const fileCount = Math.max(situation.fileRefs.length, situation.codebaseSnapshot.fileCount);
    // Base steps from blocker count (each blocker may require multiple recovery steps)
    const baseSteps = blockerCount * 3;
    // File operations estimate: ~2 steps per file on average
    const fileSteps = fileCount * 2;
    // Baseline for orchestration overhead
    const orchestrationSteps = 4;
    return baseSteps + fileSteps + orchestrationSteps;
  }

  /**
   * R9-17 fix: Derives the operational division from task situation context.
   * Previously fixed to "coding"; now uses domain hints from the situation.
   */
  private deriveDivision(situation: TaskSituation): string {
    const tools = situation.environmentContext.availableTools;
    const blockers = situation.blockers.map(b => b.description.toLowerCase());
    const objective = [
      situation.objective,
      situation.userIntent.raw,
      situation.userIntent.normalized,
      (situation as { domainId?: string }).domainId ?? "",
    ].join(" ").toLowerCase();

    // Data/analytics division: data processing, queries, pipelines
    if (tools.some(t => /data|query|pipeline|etl|warehouse|analytics/.test(t)) ||
        blockers.some(b => /data|query|pipeline|etl/.test(b)) ||
        /\b(data|analytics|pipeline|etl|query|warehouse)\b/.test(objective)) {
      return "data";
    }

    if (tools.some(t => /incident|rollback|restore|capacity|ops|operate|sre/.test(t)) ||
        blockers.some(b => /incident|rollback|restore|capacity|ops|operate|sre/.test(b)) ||
        /\b(incident|rollback|restore|capacity|ops|operate|operational|sre|cluster)\b/.test(objective)) {
      return "ops";
    }

    // Infrastructure division: deployment, DevOps, cloud ops
    if (tools.some(t => /deploy|kubernetes|terraform|aws|gcp|azure|docker|container/.test(t)) ||
        blockers.some(b => /deploy|infrastructure|cloud|docker|kubernetes/.test(b)) ||
        /\b(deploy|infrastructure|kubernetes|docker|cloud|devops)\b/.test(objective)) {
      return "infrastructure";
    }

    // Security division: security扫描, vuln, auth
    if (tools.some(t => /security|scan|vuln|auth|identity|oauth|jwt|cert/.test(t)) ||
        blockers.some(b => /security|vuln|auth|cert|pki/.test(b)) ||
        /\b(security|vuln|auth|oauth|pki)\b/.test(objective)) {
      return "security";
    }

    // Research/ML division: training, model, ml, llm
    if (tools.some(t => /train|model|ml|llm|ai|infer|tensor|gpu/.test(t)) ||
        blockers.some(b => /model|ml|llm|ai|train|tensor/.test(b)) ||
        /\b(model|ml|llm|train|ai|machine learning)\b/.test(objective)) {
      return "research";
    }

    // Default to coding division for general development tasks
    return "coding";
  }
}
