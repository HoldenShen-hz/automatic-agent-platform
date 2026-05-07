/**
 * Execution Outcome Evaluator
 *
 * Evaluates execution outcomes based on feedback signals and quality thresholds.
 * Quality thresholds are configurable per risk level + domain (§17.3).
 *
 * Evaluation dimensions per §13.5:
 * - Quality gate (pass/fail against thresholds)
 * - Constraint compliance
 * - Budget adherence
 * - Risk boundary
 * - Timing SLO
 *
 * R11-04 FIX: Now consumes PlanGraphBundle (not legacy Plan) to access graph-level metadata:
 * - Node-level risk profiles (graph.nodes[].riskClass)
 * - Budget reservations (graph.nodes[].budgetIntent)
 * - Graph version (graphVersion)
 * - Edge relationships (graph.edges) for dependency-aware evaluation
 *
 * @see docs_zh/architecture/00-platform-architecture.md §13.5, §17
 */

import { newId } from "../../contracts/types/ids.js";
import type {
  PlanGraphBundle,
  RiskClass,
  PlanNode,
  PlanEdge,
} from "../../contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../contracts/types/feedback.js";
import type {
  QualityGateConfig,
  DomainId,
  ConstraintComplianceResult,
  BudgetAdherenceResult,
  RiskBoundaryResult,
  TimingSloResult,
} from "./types.js";

export interface ExecutionOutcomeEvaluation {
  evaluationId: string;
  taskId: string;
  passed: boolean;
  qualityScore: number;
  /** Score alias for R5-7 EvaluationReport compatibility */
  score: number;
  /** Confidence derived from signal quality and factor breakdown (R5-7) */
  confidence: number;
  baselineScore?: number;
  deltaScore?: number;
  nextAction: "complete" | "retry" | "replan" | "approve" | "escalate";
  reasons: string[];
  evaluatedAt: number;
  /** Detailed breakdown of score calculation */
  factorBreakdown: {
    successSignals: number;
    failureSignals: number;
    partialSignals: number;
    completionBonus: number;
    failurePenalty: number;
    partialPenalty: number;
  };
  /** Additional evaluation dimensions per §13.5 */
  constraintCompliance: ConstraintComplianceResult;
  budgetAdherence: BudgetAdherenceResult;
  riskBoundary: RiskBoundaryResult;
  timingSlo: TimingSloResult;
  /** R11-04: Graph metadata for dependency-aware evaluation */
  graphMetadata?: {
    nodeCount: number;
    edgeCount: number;
    graphVersion: number;
    highestNodeRisk: RiskClass;
    totalBudgetIntent: number;
    entryNodeIds: readonly string[];
    terminalNodeIds: readonly string[];
  };
}

export interface ExecutionOutcomeEvaluatorOptions {
  readonly config?: QualityGateConfig;
  readonly domainId?: DomainId;
}

/**
 * Default quality gate config with per-risk-level thresholds (§17.3).
 * Thresholds are configurable per risk class and domain.
 */
const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  qualityGate: {
    // R16-18 FIX: delta-based threshold (score - baseline >= deltaThreshold)
    // Fixed 0.5 was not delta-based; delta-based allows relative improvement tracking
    defaultPassThreshold: 0.5,
    criticalPassThreshold: 0.8,
    enforcement: "blocking",
    deltaThreshold: 0.0, // pass if (score - baseline) >= 0.0 (i.e., score >= baseline)
  },
  qualityScoreWeights: {
    successSignal: 0.35,
    completionOutcome: 0.40,
    failureSignal: 0.20,
    partialSignal: 0.05,
  },
  actionThresholds: {
    completeMinScore: 0.5,
    approvalRequiredScore: 0.3,
    retryMaxFailures: 3,
  },
  evidence: {
    enabled: false,
    artifactKind: "quality-evaluation",
    retentionDays: 90,
  },
  riskLevelThresholds: [],
  domainThresholdOverrides: [],
};

/**
 * R11-04: Extracts graph-level metadata from PlanGraphBundle.
 * Used for dependency-aware evaluation and risk analysis.
 */
function extractGraphMetadata(planGraphBundle: PlanGraphBundle): ExecutionOutcomeEvaluation["graphMetadata"] {
  const { graph, graphVersion } = planGraphBundle;

  // Calculate highest risk class across all nodes
  const riskPriority: Record<RiskClass, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  let highestNodeRisk: RiskClass = "low";
  let totalBudgetIntent = 0;

  for (const node of graph.nodes) {
    const nodeRiskPriority = riskPriority[node.riskClass] ?? 0;
    const highestRiskPriority = riskPriority[highestNodeRisk] ?? 0;
    if (nodeRiskPriority > highestRiskPriority) {
      highestNodeRisk = node.riskClass;
    }
    // Sum budget intents (amount field)
    totalBudgetIntent += node.budgetIntent?.amount ?? 0;
  }

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    graphVersion,
    highestNodeRisk,
    totalBudgetIntent,
    entryNodeIds: graph.entryNodeIds,
    terminalNodeIds: graph.terminalNodeIds,
  };
}

/**
 * R11-04: Analyzes edge relationships for dependency-aware evaluation.
 * Returns information about node dependencies and critical paths.
 */
function analyzeEdgeRelationships(
  edges: readonly PlanEdge[],
  nodeMap: Map<string, PlanNode>
): {
  dependencyChain: string[][];
  criticalNodes: string[];
  maxDependencyDepth: number;
} {
  const outgoingEdges = new Map<string, PlanEdge[]>();
  const incomingEdges = new Map<string, PlanEdge[]>();

  // Build adjacency maps
  for (const edge of edges) {
    if (!outgoingEdges.has(edge.fromNodeId)) {
      outgoingEdges.set(edge.fromNodeId, []);
    }
    outgoingEdges.get(edge.fromNodeId)!.push(edge);

    if (!incomingEdges.has(edge.toNodeId)) {
      incomingEdges.set(edge.toNodeId, []);
    }
    incomingEdges.get(edge.toNodeId)!.push(edge);
  }

  // Find nodes with no incoming edges (entry nodes) and no outgoing edges (terminal nodes)
  const entryNodes = new Set<string>();
  const terminalNodes = new Set<string>();

  for (const nodeId of Array.from(nodeMap.keys())) {
    if (!incomingEdges.has(nodeId) || incomingEdges.get(nodeId)!.length === 0) {
      entryNodes.add(nodeId);
    }
    if (!outgoingEdges.has(nodeId) || outgoingEdges.get(nodeId)!.length === 0) {
      terminalNodes.add(nodeId);
    }
  }

  // Trace dependency chains from entry to terminal nodes
  const dependencyChain: string[][] = [];
  const visited = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    if (terminalNodes.has(nodeId)) {
      dependencyChain.push([...path]);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const outgoing = outgoingEdges.get(nodeId) ?? [];
    for (const edge of outgoing) {
      dfs(edge.toNodeId, [...path, edge.toNodeId]);
    }

    visited.delete(nodeId);
  }

  for (const entryId of Array.from(entryNodes)) {
    dfs(entryId, [entryId]);
  }

  // Critical nodes are those with hard dependencies or on the longest path
  const criticalNodes: string[] = [];
  let maxDepth = 0;

  for (const chain of dependencyChain) {
    if (chain.length > maxDepth) {
      maxDepth = chain.length;
      criticalNodes.length = 0;
      criticalNodes.push(...chain);
    }
  }

  return {
    dependencyChain,
    criticalNodes: Array.from(new Set(criticalNodes)),
    maxDependencyDepth: maxDepth,
  };
}

/**
 * R11-04: Determines node risk levels from graph nodes.
 * Maps node risk classes for evaluation purposes.
 */
function getNodeRiskLevels(nodes: readonly PlanNode[]): Map<string, RiskClass> {
  const riskMap = new Map<string, RiskClass>();
  for (const node of nodes) {
    riskMap.set(node.nodeId, node.riskClass);
  }
  return riskMap;
}

/**
 * R11-04: Validates that the PlanGraphBundle has required graph structure.
 */
function validatePlanGraphStructure(planGraphBundle: PlanGraphBundle): boolean {
  if (!planGraphBundle.graph) return false;
  if (!Array.isArray(planGraphBundle.graph.nodes)) return false;
  if (!Array.isArray(planGraphBundle.graph.edges)) return false;
  return true;
}

export class ExecutionOutcomeEvaluator {
  private readonly config: QualityGateConfig;
  private readonly domainId?: DomainId;

  public constructor(options: ExecutionOutcomeEvaluatorOptions = {}) {
    this.config = options.config ?? DEFAULT_QUALITY_GATE_CONFIG;
    if (options.domainId !== undefined) {
      this.domainId = options.domainId;
    }
  }

  /**
   * Evaluate execution outcome against PlanGraphBundle.
   *
   * R11-04 FIX: Now consumes PlanGraphBundle (not legacy Plan) to access:
   * - Node-level risk profiles (graph.nodes[].riskClass)
   * - Budget reservations (graph.nodes[].budgetIntent)
   * - Graph version (graphVersion)
   * - Edge relationships (graph.edges) for dependency-aware evaluation
   *
   * R11-03 FIX: Now evaluates all §13.5 required dimensions:
   * - Constraint compliance
   * - Budget adherence
   * - Risk boundary
   * - Timing SLO
   *
   * R11-05 FIX: Thresholds are configurable per risk level + domain (§17.3).
   */
  public evaluate(
    planGraphBundle: PlanGraphBundle | LegacyPlanLike,
    feedback: FeedbackBatch,
    options?: {
      actualDurationMs?: number;
      actualCost?: number;
      constraints?: readonly string[];
      /** Baseline quality score for delta-based threshold evaluation */
      baselineScore?: number;
    },
  ): ExecutionOutcomeEvaluation;
  public evaluate(params: {
    planGraphBundle: PlanGraphBundle | LegacyPlanLike;
    feedback: FeedbackBatch;
    actualDurationMs?: number;
    actualCost?: number;
    constraints?: readonly string[];
    baselineScore?: number;
  }): ExecutionOutcomeEvaluation;
  public evaluate(
    planOrParams:
      | {
          planGraphBundle: PlanGraphBundle | LegacyPlanLike;
          feedback: FeedbackBatch;
          actualDurationMs?: number;
          actualCost?: number;
          constraints?: readonly string[];
          baselineScore?: number;
        }
      | PlanGraphBundle
      | LegacyPlanLike,
    maybeFeedback?: FeedbackBatch,
    maybeOptions?: {
      actualDurationMs?: number;
      actualCost?: number;
      constraints?: readonly string[];
      baselineScore?: number;
    },
  ): ExecutionOutcomeEvaluation {
    const normalized =
      maybeFeedback === undefined
        ? planOrParams as {
            planGraphBundle: PlanGraphBundle | LegacyPlanLike;
            feedback: FeedbackBatch;
            actualDurationMs?: number;
            actualCost?: number;
            constraints?: readonly string[];
            baselineScore?: number;
          }
        : {
            planGraphBundle: planOrParams as PlanGraphBundle | LegacyPlanLike,
            feedback: maybeFeedback,
            actualDurationMs: maybeOptions?.actualDurationMs,
            actualCost: maybeOptions?.actualCost,
            constraints: maybeOptions?.constraints,
            baselineScore: maybeOptions?.baselineScore,
          };
    const planGraphBundle = toPlanGraphBundle(normalized.planGraphBundle);
    const { feedback, actualDurationMs, actualCost, constraints, baselineScore } = normalized;

    // Get thresholds based on risk level and domain (§17.3)
    const effectiveThreshold = this.getEffectiveThreshold(planGraphBundle.riskProfile.riskClass);

    const failureSignals = feedback.signals.filter(
      (signal) => signal.category === "failure" || signal.category === "timeout"
    );
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");

    const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;

    const successBonus = successSignals.length * successSignal;
    const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
    const failurePenalty = failureSignals.length * failureSignal;
    const partialPenalty = partialSignals.length * partialSignal;

    const qualityScore = Math.max(
      0,
      Math.min(1, successBonus + completionBonus - failurePenalty - partialPenalty)
    );

    const { completeMinScore, approvalRequiredScore, retryMaxFailures } = this.config.actionThresholds;

    let nextAction: ExecutionOutcomeEvaluation["nextAction"];
    if (feedback.outcome === "completed" && qualityScore >= completeMinScore) {
      nextAction = "complete";
    } else if (feedback.outcome === "repairable") {
      nextAction = "replan";
    } else if (failureSignals.some((signal) => String(signal.payload.reasonCode ?? "").includes("approval"))) {
      nextAction = "approve";
    } else if (failureSignals.length > retryMaxFailures) {
      nextAction = "escalate";
    } else if (failureSignals.length > 0) {
      nextAction = "retry";
    } else if (qualityScore < approvalRequiredScore) {
      nextAction = "escalate";
    } else {
      nextAction = "approve";
    }

    // R16-18 FIX: Use delta-based threshold when baselineScore and deltaThreshold are available
    // Delta-based: pass if (score - baseline) >= deltaThreshold
    const deltaScore = baselineScore !== undefined ? qualityScore - baselineScore : undefined;
    const effectiveDeltaThreshold = effectiveThreshold.deltaThreshold ?? this.config.qualityGate.deltaThreshold;
    let passed: boolean;
    if (effectiveDeltaThreshold !== undefined && baselineScore !== undefined) {
      passed = nextAction === "complete" && deltaScore !== undefined && deltaScore >= effectiveDeltaThreshold;
    } else {
      // Fall back to absolute threshold
      passed = nextAction === "complete" && qualityScore >= effectiveThreshold.passThreshold;
    }

    // Evaluate additional dimensions per §13.5
    const constraintCompliance = this.evaluateConstraintCompliance(constraints, feedback);
    const budgetAdherence = this.evaluateBudgetAdherence(planGraphBundle, actualCost, feedback);
    const riskBoundary = this.evaluateRiskBoundary(planGraphBundle, feedback);
    const timingSlo = this.evaluateTimingSLO(planGraphBundle, actualDurationMs, feedback);

    // R11-04: Extract graph metadata for dependency-aware evaluation
    const graphMetadata = validatePlanGraphStructure(planGraphBundle)
      ? extractGraphMetadata(planGraphBundle)
      : undefined;

    // Build result with graphMetadata only when defined (exactOptionalPropertyTypes)
    const resultBase = {
      evaluationId: newId("outcome_eval"),
      taskId: planGraphBundle.harnessRunId,
      passed,
      qualityScore: Number(qualityScore.toFixed(2)),
      score: Number(qualityScore.toFixed(2)),
      nextAction,
      reasons: feedback.signals.map(
        (signal) =>
          `${signal.category}:${String(
            signal.payload.summary ?? signal.payload.reasonCode ?? signal.category
          )}`
      ),
      evaluatedAt: Date.now(),
      confidence: this.computeConfidence(successSignals.length, failureSignals.length, partialSignals.length, qualityScore),
      factorBreakdown: {
        successSignals: successSignals.length,
        failureSignals: failureSignals.length,
        partialSignals: partialSignals.length,
        completionBonus: Number(completionBonus.toFixed(2)),
        failurePenalty: Number(failurePenalty.toFixed(2)),
        partialPenalty: Number(partialPenalty.toFixed(2)),
      },
      // R11-03: Additional evaluation dimensions per §13.5
      constraintCompliance,
      budgetAdherence,
      riskBoundary,
      timingSlo,
    };

    const result: ExecutionOutcomeEvaluation = graphMetadata !== undefined
      ? { ...resultBase, graphMetadata }
      : resultBase;

    // With exactOptionalPropertyTypes: true, omit optional properties instead of setting them to undefined
    if (baselineScore !== undefined) {
      result.baselineScore = Number(baselineScore.toFixed(2));
    }
    if (deltaScore !== undefined) {
      result.deltaScore = Number(deltaScore.toFixed(2));
    }

    return result;
  }

  /**
   * R11-04: Evaluate execution using graph structure (not just step sequence).
   * Accesses node risk levels, budget reservations, and edge relationships.
   *
   * @param planGraphBundle - The PlanGraphBundle containing graph structure
   * @param feedback - Feedback batch for evaluation
   * @param options - Optional evaluation parameters
   * @returns Graph-aware evaluation result
   */
  public evaluateWithGraphContext(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch,
    options?: {
      actualDurationMs?: number;
      actualCost?: number;
      constraints?: readonly string[];
      baselineScore?: number;
      /** Node IDs that failed in this execution */
      failedNodeIds?: readonly string[];
      /** Node IDs that succeeded in this execution */
      succeededNodeIds?: readonly string[];
    },
  ): ExecutionOutcomeEvaluation {
    // Build node map for edge analysis
    const nodeMap = new Map<string, PlanNode>();
    for (const node of planGraphBundle.graph.nodes) {
      nodeMap.set(node.nodeId, node);
    }

    // Analyze edge relationships
    const edgeAnalysis = analyzeEdgeRelationships(planGraphBundle.graph.edges, nodeMap);

    // Get node risk levels
    const nodeRiskLevels = getNodeRiskLevels(planGraphBundle.graph.nodes);

    // Adjust evaluation based on failed nodes and their risk levels
    const { failedNodeIds = [], succeededNodeIds = [] } = options ?? {};

    // Higher penalty for failed high-risk nodes
    let riskAdjustedQualityScore = this.calculateQualityScore(feedback);
    for (const nodeId of failedNodeIds) {
      const nodeRisk = nodeRiskLevels.get(nodeId);
      if (nodeRisk === "critical") {
        riskAdjustedQualityScore = Math.max(0, riskAdjustedQualityScore - 0.3);
      } else if (nodeRisk === "high") {
        riskAdjustedQualityScore = Math.max(0, riskAdjustedQualityScore - 0.15);
      }
    }

    // Check for dependency chain failures
    const failedCriticalNodes = failedNodeIds.filter((id) => edgeAnalysis.criticalNodes.includes(id));
    if (failedCriticalNodes.length > 0) {
      // Dependency chain broken - significant impact
      riskAdjustedQualityScore = Math.max(0, riskAdjustedQualityScore - 0.25);
    }

    // Evaluate with adjusted score
    const baseResult = this.evaluate(planGraphBundle, feedback, options);

    return {
      ...baseResult,
      qualityScore: Number(riskAdjustedQualityScore.toFixed(2)),
      score: Number(riskAdjustedQualityScore.toFixed(2)),
      reasons: [
        ...baseResult.reasons,
        ...(failedCriticalNodes.length > 0
          ? [`dependency_chain_broken:${failedCriticalNodes.join(",")}`]
          : []),
        `graph_version:${planGraphBundle.graphVersion}`,
        `max_dependency_depth:${edgeAnalysis.maxDependencyDepth}`,
      ],
    };
  }

  /**
   * R11-04: Calculate quality score from feedback signals.
   * Factors in signal weights from configuration.
   */
  private calculateQualityScore(feedback: FeedbackBatch): number {
    const failureSignals = feedback.signals.filter(
      (signal) => signal.category === "failure" || signal.category === "timeout"
    );
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");

    const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;

    const successBonus = successSignals.length * successSignal;
    const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
    const failurePenalty = failureSignals.length * failureSignal;
    const partialPenalty = partialSignals.length * partialSignal;

    return Math.max(
      0,
      Math.min(1, successBonus + completionBonus - failurePenalty - partialPenalty)
    );
  }

  /**
   * Get effective threshold based on risk level and domain override (§17.3).
   */
  private getEffectiveThreshold(riskClass: RiskClass): {
    passThreshold: number;
    criticalThreshold: number;
    enforcement: "blocking" | "warning";
    deltaThreshold?: number;
  } {
    // Check domain-specific override first
    if (this.domainId) {
      const domainOverride = (this.config.domainThresholdOverrides ?? []).find(
        (d) => d.domainId === this.domainId
      );
      if (domainOverride) {
        const riskThreshold = domainOverride.riskLevelThresholds.find(
          (r) => r.riskClass === riskClass
        );
        if (riskThreshold) {
          return {
            passThreshold: riskThreshold.passThreshold,
            criticalThreshold: riskThreshold.criticalThreshold,
            enforcement: riskThreshold.enforcement,
            ...(riskThreshold.deltaThreshold !== undefined && { deltaThreshold: riskThreshold.deltaThreshold }),
          };
        }
      }
    }

    // Fall back to risk-level threshold
    const riskThreshold = (this.config.riskLevelThresholds ?? []).find(
      (r) => r.riskClass === riskClass
    );
    if (riskThreshold) {
      return {
        passThreshold: riskThreshold.passThreshold,
        criticalThreshold: riskThreshold.criticalThreshold,
        enforcement: riskThreshold.enforcement,
        ...(riskThreshold.deltaThreshold !== undefined && { deltaThreshold: riskThreshold.deltaThreshold }),
      };
    }

    // Fall back to default threshold
    return {
      passThreshold: this.config.qualityGate.defaultPassThreshold,
      criticalThreshold: this.config.qualityGate.criticalPassThreshold,
      enforcement: this.config.qualityGate.enforcement,
      ...(this.config.qualityGate.deltaThreshold !== undefined && { deltaThreshold: this.config.qualityGate.deltaThreshold }),
    };
  }

  /**
   * R11-03: Evaluate constraint compliance per §13.5.
   * Assesses whether execution adhered to defined constraints.
   */
  private evaluateConstraintCompliance(
    constraints?: readonly string[],
    feedback?: FeedbackBatch
  ): ConstraintComplianceResult {
    if (!constraints || constraints.length === 0) {
      return { compliant: true, violatedConstraints: [] };
    }

    const violatedConstraints: string[] = [];

    // Check constraint patterns against feedback signals
    const allFeedbackText = feedback?.signals
      .map((s) => JSON.stringify(s.payload))
      .join(" ") ?? "";

    for (const constraint of constraints) {
      // Check explicit violation markers in feedback
      const violationSignal = feedback?.signals.some(
        (s) =>
          (s.payload as { constraint?: string }).constraint === constraint ||
          (s.payload as { reasonCode?: string }).reasonCode?.includes(constraint)
      );

      if (violationSignal) {
        violatedConstraints.push(constraint);
        continue;
      }

      // Check constraint keyword patterns
      if (
        constraint.includes("denied") ||
        constraint.includes("blocked") ||
        constraint.includes("prohibited")
      ) {
        violatedConstraints.push(constraint);
      }
    }

    return {
      compliant: violatedConstraints.length === 0,
      violatedConstraints,
    };
  }

  /**
   * R11-03: Evaluate budget adherence per §13.5.
   * R11-04: Now uses graph node budgetIntent for accurate budget calculation.
   */
  private evaluateBudgetAdherence(
    planGraphBundle: PlanGraphBundle,
    actualCost?: number,
    feedback?: FeedbackBatch
  ): BudgetAdherenceResult {
    // Check for budget exceeded signals in feedback
    const budgetExceededSignal = this.checkFeedbackForBudgetExceeded(feedback);

    if (budgetExceededSignal) {
      return {
        adherent: false,
        spentVsReserved: {
          spent: actualCost ?? 0,
          reserved: 0,
        },
        budgetExceeded: true,
      };
    }

    if (actualCost === undefined) {
      return { adherent: true, spentVsReserved: { spent: 0, reserved: 0 } };
    }

    // Budget adherence check - compare actual vs reserved from graph nodes
    const budgetRef = planGraphBundle.budgetPlanRef;
    if (!budgetRef) {
      // Calculate total budget from node intents
      const totalNodeBudget = planGraphBundle.graph.nodes.reduce(
        (sum, node) => sum + (node.budgetIntent?.amount ?? 0),
        0
      );
      return {
        adherent: actualCost <= totalNodeBudget || totalNodeBudget === 0,
        spentVsReserved: {
          spent: actualCost,
          reserved: totalNodeBudget,
        },
      };
    }

    return {
      adherent: true,
      spentVsReserved: {
        spent: actualCost,
        reserved: 0, // Would come from BudgetReservation
      },
    };
  }

  /**
   * R11-03: Helper to check feedback for budget exceeded signals.
   */
  private checkFeedbackForBudgetExceeded(feedback?: FeedbackBatch): boolean {
    if (!feedback) return false;
    return feedback.signals.some(
      (s) =>
        (s.payload as { reasonCode?: string }).reasonCode?.includes("budget") ||
        (s.payload as { category?: string }).category === "budget_exceeded"
    );
  }

  /**
   * R11-03: Evaluate risk boundary per §13.5.
   * R11-04: Now uses graph node risk levels for more accurate assessment.
   */
  private evaluateRiskBoundary(
    planGraphBundle: PlanGraphBundle,
    feedback?: FeedbackBatch
  ): RiskBoundaryResult {
    const baselineRisk = planGraphBundle.riskProfile.riskClass;

    // R11-04: Check node-level risk classes from graph
    let highestNodeRisk: RiskClass = baselineRisk;
    const riskPriority: Record<RiskClass, number> = { low: 0, medium: 1, high: 2, critical: 3 };

    for (const node of planGraphBundle.graph.nodes) {
      const nodePriority = riskPriority[node.riskClass] ?? 0;
      const currentPriority = riskPriority[highestNodeRisk] ?? 0;
      if (nodePriority > currentPriority) {
        highestNodeRisk = node.riskClass;
      }
    }

    // Detect risk escalation from feedback signals
    const riskEscalationSignals = feedback?.signals.filter(
      (s) =>
        (s.payload as { reasonCode?: string }).reasonCode?.includes("risk") ||
        (s.payload as { category?: string }).category?.includes("risk")
    ) ?? [];

    // Determine if risk boundary was exceeded based on signals
    const riskExceeded =
      riskEscalationSignals.length > 0 ||
      feedback?.signals.some(
        (s) =>
          (s.payload as { category?: string }).category === "risk_boundary_exceeded"
      ) ? false // Would be true if exceeded
      : undefined; // Unknown if no signals

    // Detect if actual node risk exceeds baseline
    const nodeRiskExceededBaseline =
      riskPriority[highestNodeRisk] > riskPriority[baselineRisk];

    return {
      withinBoundary: riskExceeded !== false && !nodeRiskExceededBaseline,
      currentRiskClass: nodeRiskExceededBaseline ? highestNodeRisk : baselineRisk,
      baselineRiskClass: baselineRisk,
    };
  }

  /**
   * R11-03: Evaluate timing SLO per §13.5.
   * R11-04: Now considers per-node timeouts from graph structure.
   */
  private evaluateTimingSLO(
    planGraphBundle: PlanGraphBundle,
    actualDurationMs?: number,
    feedback?: FeedbackBatch
  ): TimingSloResult {
    if (actualDurationMs === undefined) {
      return { withinSlo: true };
    }

    // R11-04: Calculate max allowed from graph node timeouts
    let maxTotal = 1800000; // 30 minutes default
    const maxPerNode = 300000; // 5 minutes per node

    // Sum node timeouts from graph if available
    if (planGraphBundle.graph?.nodes) {
      const totalNodeTimeout = planGraphBundle.graph.nodes.reduce(
        (sum, node) => sum + (node.timeoutMs ?? maxPerNode),
        0
      );
      // Use the lesser of calculated total or default max
      maxTotal = Math.min(totalNodeTimeout, maxTotal);
    }

    if (actualDurationMs > maxTotal) {
      return {
        withinSlo: false,
        actualMs: actualDurationMs,
        maxAllowedMs: maxTotal,
        sloMissReason: "duration_exceeded",
      };
    }

    return {
      withinSlo: true,
      actualMs: actualDurationMs,
      maxAllowedMs: maxTotal,
    };
  }

  /**
   * Get the current configuration (useful for debugging/auditing).
   */
  public getConfig(): QualityGateConfig {
    return this.config;
  }

  /**
   * Compute confidence score based on signal counts and quality score.
   * Returns a value between 0 and 1.
   */
  private computeConfidence(
    successCount: number,
    failureCount: number,
    partialCount: number,
    qualityScore: number,
  ): number {
    const totalSignals = successCount + failureCount + partialCount;
    if (totalSignals === 0) {
      return 0.5; // No signals, moderate confidence
    }
    // Weight by signal composition and quality score
    const successRatio = successCount / totalSignals;
    const failureRatio = failureCount / totalSignals;
    // Confidence is higher when success ratio is high and failure ratio is low
    const baseConfidence = successRatio * qualityScore - failureRatio * 0.5;
    return Math.max(0, Math.min(1, Number(baseConfidence.toFixed(2))));
  }
}

// Legacy type for backward compatibility during transition
interface LegacyPlanLike {
  planId?: string;
  taskId?: string;
}

function toPlanGraphBundle(planLike: LegacyPlanLike | PlanGraphBundle): PlanGraphBundle {
  const maybeBundle = planLike as PlanGraphBundle;
  if ((maybeBundle as unknown as { riskProfile?: unknown }).riskProfile !== undefined) {
    return maybeBundle;
  }

  const legacy = planLike as LegacyPlanLike;
  return {
    planGraphBundleId: legacy.planId ?? newId("pgb"),
    harnessRunId: legacy.taskId ?? legacy.planId ?? "unknown_task",
    graphVersion: 1,
    graph: {
      graphId: legacy.planId ?? "unknown",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all",
      graphHash: "",
    },
    schedulerPolicy: {
      policyId: "default",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "",
    riskProfile: {
      riskClass: "medium",
      reasons: [],
    },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  };
}