import { newId } from "../../contracts/types/ids.js";
import type { Plan, UnifiedAssessment } from "../oapeflir/types/index.js";
import { PlanDagValidator } from "./plan-dag-validator.js";

/**
 * EvaluationReport per §45.10
 * Produced by Evaluator stage in place of ExecutionOutcomeEvaluation.
 */
export interface EvaluationReport {
  readonly passed: boolean;
  readonly score: number;
  readonly issues: readonly string[];
  readonly recommendation: string;
  readonly confidence: number;
  readonly evaluationId: string;
  readonly evaluatedAt: number;
}

export interface PlanEvaluation {
  viable: boolean;
  riskLevel: UnifiedAssessment["risk"];
  issues: string[];
  estimatedCostUsd: number;
  estimatedTokenBudget: number;
}

/**
 * Estimates the token budget required for a plan based on step analysis.
 * Uses parallel branch detection and risk-weighted cost estimation.
 *
 * R20-04: Now uses per-step cost analysis, tool costs, and parallelism cost.
 * Previously used naive steps.length*1000 heuristic.
 */
function estimateTokenBudget(steps: Plan["steps"], assessment: UnifiedAssessment): number {
  if (steps.length === 0) {
    return 0;
  }

  // Build dependency graph to detect parallel branches
  const stepById = new Map(steps.map((step) => [step.stepId, step]));
  const dependents = new Map<string, string[]>();

  for (const step of steps) {
    dependents.set(step.stepId, []);
  }
  for (const step of steps) {
    for (const depId of step.dependencies) {
      dependents.get(depId)?.push(step.stepId);
    }
  }

  // Calculate depth and parallel factor for each step
  const stepDepth = new Map<string, number>();
  const stepParallelFactor = new Map<string, number>();

  function getDepth(stepId: string): number {
    const cached = stepDepth.get(stepId);
    if (cached !== undefined) {
      return cached;
    }
    const step = stepById.get(stepId);
    if (!step || step.dependencies.length === 0) {
      const depth = 0;
      stepDepth.set(stepId, depth);
      return depth;
    }
    const maxDepDepth = Math.max(...step.dependencies.map((depId) => getDepth(depId)));
    const depth = maxDepDepth + 1;
    stepDepth.set(stepId, depth);
    return depth;
  }

  for (const step of steps) {
    getDepth(step.stepId);
  }

  // Calculate parallel factor: number of steps at the same depth level
  const depthCounts = new Map<number, number>();
  for (const depth of stepDepth.values()) {
    depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
  }

  // R20-04: Per-step base cost - different tools have different token costs
  const toolCostMap: Record<string, number> = {
    read: 200,
    execute: 500,
    write: 300,
    validate_output: 150,
    apply_patch: 400,
    llm: 800,
    default: 350,
  };

  function getStepCost(step: Plan["steps"][0]): number {
    const action = step.action?.toLowerCase() ?? "default";
    return toolCostMap[action] ?? toolCostMap.default;
  }

  // Risk-weighted multiplier
  const riskMultipliers: Record<string, number> = {
    low: 1.0,
    medium: 1.5,
    high: 2.0,
    critical: 3.0,
  };
  const riskMultiplier = riskMultipliers[assessment.risk] ?? 1.0;

  // Calculate total estimated tokens
  // Formula: sum of (per-step cost * risk multiplier) for each depth level,
  // accounting for parallel execution at each depth
  let totalCost = 0;
  for (const step of steps) {
    // Each step has its own cost, not just depth-based
    const stepCost = getStepCost(step) * riskMultiplier;
    // Parallelism adjustment: steps at same depth compete for resources
    const depth = stepDepth.get(step.stepId) ?? 0;
    const parallelAtDepth = depthCounts.get(depth) ?? 1;
    const parallelismCost = stepCost * Math.ceil(parallelAtDepth / 2);
    totalCost += parallelismCost;
  }

  // Add overhead for dependencies and coordination
  const dependencyOverhead = steps.reduce((sum, step) => sum + step.dependencies.length * 50, 0);

  return Math.ceil(totalCost + dependencyOverhead);
}

/**
 * Estimates the cost in USD for executing a plan.
 * Uses token estimation and typical pricing.
 */
function estimateCostUsd(steps: Plan["steps"], assessment: UnifiedAssessment): number {
  const tokenBudget = estimateTokenBudget(steps, assessment);
  // Average cost per token in USD (input + output average)
  const costPerTokenUsd = 0.00001; // $0.00001 per token
  return tokenBudget * costPerTokenUsd;
}

export class PlanEvaluator {
  private readonly dagValidator = new PlanDagValidator();

  public evaluate(plan: Plan, assessment: UnifiedAssessment): PlanEvaluation {
    const issues: string[] = [];
    if (plan.steps.length === 0) {
      issues.push("planning.empty_plan");
    }
    if (assessment.risk === "critical" && !assessment.approvalPolicy.required) {
      issues.push("planning.missing_critical_approval_constraint");
    }
    const dagValidation = this.dagValidator.validate(plan.steps);
    issues.push(...dagValidation.issues);

    const estimatedTokenBudget = estimateTokenBudget(plan.steps, assessment);
    if (estimatedTokenBudget > assessment.resourceAllocation.maxTokens) {
      issues.push("planning.resource_budget_exceeded");
    }

    // R20-05: Check parallelism limit - max concurrent steps must not exceed capacity
    // Build dependency graph to find max parallelism (steps at same depth level)
    const stepById = new Map(plan.steps.map((s) => [s.stepId, s]));
    const depthCounts = new Map<number, number>();
    for (const step of plan.steps) {
      let depth = 0;
      for (const dep of step.dependencies) {
        if (stepById.get(dep)) {
          depth += 1;
        }
      }
      depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
    }
    const maxConcurrentSteps = Math.max(...depthCounts.values(), 1);
    if (maxConcurrentSteps > 10) {
      issues.push(`planning.parallelism_exceeded:max=${10},actual=${maxConcurrentSteps}`);
    }
    const PARALLELISM_LIMIT = 10;
    if (maxConcurrentSteps > PARALLELISM_LIMIT) {
      issues.push(`planning.parallelism_exceeded:limit=${PARALLELISM_LIMIT},actual=${maxConcurrentSteps}`);
    }

    const estimatedCostUsd = estimateCostUsd(plan.steps, assessment);

    return {
      viable: issues.length === 0,
      riskLevel: assessment.risk,
      issues,
      estimatedCostUsd,
      estimatedTokenBudget,
    };
  }

  /**
   * Produce EvaluationReport per §45.10
   * Replaces ExecutionOutcomeEvaluation with proper type.
   */
  public produceEvaluationReport(plan: Plan, assessment: UnifiedAssessment): EvaluationReport {
    const evaluation = this.evaluate(plan, assessment);
    const issues: string[] = [...evaluation.issues];

    // Compute recommendation based on evaluation
    let recommendation: string;
    if (evaluation.viable) {
      recommendation = evaluation.riskLevel === "critical" ? "require_human_approval" : "proceed_to_execute";
    } else if (issues.some((i) => i.includes("resource_budget"))) {
      recommendation = "reduce_scope_or_allocate_more_budget";
    } else if (issues.some((i) => i.includes("cycle"))) {
      recommendation = "fix_dag_structure";
    } else {
      recommendation = "replan_required";
    }

    // Score: 0-1 based on viability and risk
    const baseScore = evaluation.viable ? 0.7 : 0.3;
    const riskAdjustment =
      evaluation.riskLevel === "critical" ? -0.2 : evaluation.riskLevel === "high" ? -0.1 : 0;
    const score = Math.max(0, Math.min(1, baseScore + riskAdjustment));

    // Confidence: based on DAG validation completeness
    const dagValidation = this.dagValidator.validate(plan.steps);
    const confidence = dagValidation.valid ? 0.9 : 0.6;

    return {
      evaluationId: newId("eval_report"),
      passed: evaluation.viable && score >= 0.5,
      score: Number(score.toFixed(2)),
      issues,
      recommendation,
      confidence: Number(confidence.toFixed(2)),
      evaluatedAt: Date.now(),
    };
  }
}
