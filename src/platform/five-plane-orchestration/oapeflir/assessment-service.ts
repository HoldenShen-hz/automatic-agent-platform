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

    // R9-17 fix: Derive division from task situation domain hints, not hardcoded "coding"
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

    if (risk === "critical" || fileCount >= this.fileCountThresholds.critical || blockerCount >= this.blockerCountThresholds.critical) {
      return "critical";
    }
    if (risk === "high" || fileCount >= this.fileCountThresholds.high || blockerCount >= this.blockerCountThresholds.high) {
      return "complex";
    }
    if (fileCount >= this.fileCountThresholds.moderate || memoryCount > 0 || blockerCount >= this.blockerCountThresholds.moderate) {
      return "moderate";
    }
    if (fileCount >= this.fileCountThresholds.simple) {
      return "simple";
    }
    return "trivial";
  }

  /**
   * R9-17 fix: Derives the operational division from task situation context.
   * Previously hardcoded to "coding" - now uses domain hints from the situation.
   */
  private deriveDivision(situation: TaskSituation): string {
    const tools = situation.environmentContext.availableTools;
    const blockers = situation.blockers.map(b => b.description.toLowerCase());
    const objective = situation.userIntent.raw.toLowerCase();

    // Data/analytics division: data processing, queries, pipelines
    if (tools.some(t => /data|query|pipeline|etl|warehouse|analytics/.test(t)) ||
        blockers.some(b => /data|query|pipeline|etl/.test(b)) ||
        /data |analytics |pipeline |etl |query /.test(objective)) {
      return "data";
    }

    // Infrastructure division: deployment, DevOps, cloud ops
    if (tools.some(t => /deploy|kubernetes|terraform|aws|gcp|azure|docker|container/.test(t)) ||
        blockers.some(b => /deploy|infrastructure|cloud|docker|kubernetes/.test(b)) ||
        /deploy |infrastructure |kubernetes |docker |cloud |devops/.test(objective)) {
      return "infrastructure";
    }

    // Security division: security扫描, vuln, auth
    if (tools.some(t => /security|scan|vuln|auth|identity|oauth|jwt|cert/.test(t)) ||
        blockers.some(b => /security|vuln|auth|cert|pki/.test(b)) ||
        /security |vuln |auth |oauth |pki/.test(objective)) {
      return "security";
    }

    // Research/ML division: training, model, ml, llm
    if (tools.some(t => /train|model|ml|llm|ai|infer|tensor|gpu/.test(t)) ||
        blockers.some(b => /model|ml|llm|ai|train|tensor/.test(b)) ||
        /model |ml |llm |train |ai |machine learning/.test(objective)) {
      return "research";
    }

    // Default to coding division for general development tasks
    return "coding";
  }
}
