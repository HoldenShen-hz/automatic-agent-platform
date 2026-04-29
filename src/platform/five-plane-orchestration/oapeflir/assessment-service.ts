import {
  createTaskSituationRef,
  parseTaskSituation,
  type AssessmentComplexity,
  type TaskSituation,
  type UnifiedAssessment,
} from "./types/index.js";

export interface AssessmentServiceOptions {
  highRiskTools?: readonly string[];
  defaultDivision?: string;
}

export class AssessmentService {
  private readonly highRiskTools: ReadonlySet<string>;
  private readonly defaultDivision: string;

  public constructor(options: AssessmentServiceOptions = {}) {
    this.highRiskTools = new Set(options.highRiskTools ?? ["apply_patch", "shell", "deploy"]);
    this.defaultDivision = options.defaultDivision ?? "coding";
  }

  public assess(input: TaskSituation): UnifiedAssessment {
    const situation = parseTaskSituation(input);
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
        division: situation.domainId ?? this.defaultDivision,
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
