import {
  createTaskSituationRef,
  parseTaskSituation,
  type AssessmentComplexity,
  type TaskSituation,
  type UnifiedAssessment,
  type EffectivePolicySnapshot,
  type CanonicalRiskAssessment,
} from "./types/index.js";
import type { ConstraintPack } from "../harness/index.js";

export interface AssessmentServiceOptions {
  highRiskTools?: readonly string[];
}

export interface AssessmentInput {
  readonly taskSituation: TaskSituation;
  readonly constraintPack?: ConstraintPack;
  readonly effectivePolicySnapshot?: EffectivePolicySnapshot;
  readonly inheritedRiskAssessment?: CanonicalRiskAssessment;
}

export class AssessmentService {
  private readonly highRiskTools: ReadonlySet<string>;

  /** Keyword patterns for deriving division capability from task content */
  private static readonly DIVISION_KEYWORDS = {
    coding: [
      "code", "implement", "feature", "bug", "fix", "refactor", "test", "debug",
      "function", "class", "module", "api", "interface", "type", "schema",
      "programming", "algorithm", "logic", "software", "developer", "commit",
      "build", "compile", "lint", "format", "review", "pull request", "merge",
    ],
    data: [
      "data", "analytics", "pipeline", "etl", "warehouse", "dataset", "query",
      "metric", "dashboard", "report", "statistics", "analysis", "visualization",
      "database", "sql", "table", "column", "row", "schema", "transform",
      "aggregation", "filter", "join", "index", "migration", "model training",
    ],
    ops: [
      "deploy", "infrastructure", "server", "cluster", "kubernetes", "docker",
      "monitor", "observability", "logging", "metrics", "alerting", "incident",
      "release", "rollback", "migration", "backup", "restore", "capacity",
      "scale", "load balancer", "cdn", "cache", "queue", "worker", "cron",
    ],
  } as const;

  public constructor(options: AssessmentServiceOptions = {}) {
    this.highRiskTools = new Set(options.highRiskTools ?? ["apply_patch", "shell", "deploy"]);
  }

  /**
   * Derives the division capability from task analysis.
   * R9-17: Division was previously hardcoded to "coding" - now derived from task intent/domain.
   *
   * @param situation - The parsed task situation
   * @returns The division capability: "coding", "data", or "ops"
   */
  private deriveDivisionCapability(situation: TaskSituation): string {
    // If domainId is available, map it to a capability category
    if (situation.domainId != null && situation.domainId.length > 0) {
      return this.domainIdToCapability(situation.domainId);
    }

    // Fall back to keyword-based analysis of task content
    return this.analyzeTaskContentForCapability(situation);
  }

  /**
   * Maps a domain ID to a capability category.
   * Domain IDs like "coding", "data-engineering", "it-operations" map to "coding", "data", "ops".
   */
  private domainIdToCapability(domainId: string): string {
    const normalizedDomain = domainId.toLowerCase();

    // Direct coding domain mappings
    if (normalizedDomain === "coding" || normalizedDomain === "game-dev" || normalizedDomain === "software-development") {
      return "coding";
    }

    // Data domain mappings
    if (normalizedDomain === "data-engineering" || normalizedDomain === "knowledge-base" ||
        normalizedDomain === "academic-research" || normalizedDomain === "industry-research" ||
        normalizedDomain === "quant-trading" || normalizedDomain === "analytics") {
      return "data";
    }

    // Ops domain mappings
    if (normalizedDomain === "it-operations" || normalizedDomain === "supply-chain" ||
        normalizedDomain === "customer-service" || normalizedDomain === "user-operations" ||
        normalizedDomain === "live-streaming") {
      return "ops";
    }

    // Additional mappings based on LEGACY_DOMAIN_BINDING_ALIASES patterns
    if (normalizedDomain === "engineering_ops" || normalizedDomain === "platform_engineering" ||
        normalizedDomain === "engineering" || normalizedDomain === "quality-assurance" ||
        normalizedDomain === "project-management") {
      return "coding";
    }

    if (normalizedDomain === "research" || normalizedDomain === "data" || normalizedDomain === "data_analysis") {
      return "data";
    }

    if (normalizedDomain === "operations" || normalizedDomain === "general_ops" || normalizedDomain === "support") {
      return "ops";
    }

    // Default to "coding" as the most common division if unclassified
    return "coding";
  }

  /**
   * Analyzes task content (objective and user intent) to determine the capability category.
   * Uses keyword matching to classify tasks as coding, data, or ops.
   */
  private analyzeTaskContentForCapability(situation: TaskSituation): string {
    const textToAnalyze = [
      situation.objective,
      situation.userIntent.normalized,
      situation.userIntent.raw,
    ].join(" ").toLowerCase();

    let codingScore = 0;
    let dataScore = 0;
    let opsScore = 0;

    for (const keyword of AssessmentService.DIVISION_KEYWORDS.coding) {
      if (textToAnalyze.includes(keyword)) codingScore++;
    }

    for (const keyword of AssessmentService.DIVISION_KEYWORDS.data) {
      if (textToAnalyze.includes(keyword)) dataScore++;
    }

    for (const keyword of AssessmentService.DIVISION_KEYWORDS.ops) {
      if (textToAnalyze.includes(keyword)) opsScore++;
    }

    // Return the capability with the highest score, defaulting to "coding"
    if (codingScore >= dataScore && codingScore >= opsScore) {
      return "coding";
    }
    if (dataScore >= codingScore && dataScore >= opsScore) {
      return "data";
    }
    if (opsScore >= codingScore && opsScore >= dataScore) {
      return "ops";
    }

    return "coding";
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

    // Build the effective policy snapshot from input and computed values
    const effectivePolicySnapshot: EffectivePolicySnapshot | undefined = assessmentInput.effectivePolicySnapshot ?? {
      snapshotId: `policy_snapshot:${situation.taskId}:${Date.now()}`,
      requiredApprovalLevel: approvalRequired ? (risk === "critical" ? "admin" : "user") : "none",
      blockedTools: [],
      forcedExecutionMode: executionMode,
    };

    // Build the canonical risk assessment per §13.1.1
    const riskAssessmentOutput: CanonicalRiskAssessment = {
      level: risk,
      factors: riskFactors,
    };

    return {
      taskId: situation.taskId,
      timestamp: Date.now(),
      situationRef: createTaskSituationRef(situation),
      phase: "pre-execution",
      complexity,
      risk,
      riskAssessment: riskAssessmentOutput,
      // §13.1.1: Output constraintPack consumed by Assess
      constraintPack: assessmentInput.constraintPack ?? {
        policyIds: [],
        approvalMode: "none",
        autonomyMode: "suggestion",
        toolPolicy: { allowedTools: [] },
      },
      // §13.1.1: Output effectivePolicySnapshot produced by Assess
      effectivePolicySnapshot,
      routingDecision: {
        // R9-17 FIX: Division is now derived from task classification using intent analysis
        // Previously hardcoded to "coding" and then changed to situation.domainId
        // Now uses deriveDivisionCapability to get capability-based division:
        // "coding" for dev tasks, "data" for data tasks, "ops" for operational tasks
        division: this.deriveDivisionCapability(situation),
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
    const budgetEnvelope = constraintPack.budgetEnvelope ?? constraintPack.budget;
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
