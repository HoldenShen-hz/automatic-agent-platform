import type { Plan, UnifiedAssessment } from "../oapeflir/types/index.js";
import { PlanDagValidator } from "./plan-dag-validator.js";

/**
 * Token estimation result with breakdown.
 */
export interface TokenEstimation {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimateUsd: number;
}

/**
 * Configuration for token estimation.
 */
export interface TokenEstimationConfig {
  /** Average tokens per step for input estimation */
  avgInputTokensPerStep: number;
  /** Average tokens per step for output estimation */
  avgOutputTokensPerStep: number;
  /** Cost per 1M tokens in USD */
  costPerMillionTokens: number;
  /** Additional overhead multiplier for complex plans */
  overheadMultiplier: number;
}

/**
 * Default token estimation configuration.
 */
const DEFAULT_TOKEN_ESTIMATION_CONFIG: TokenEstimationConfig = {
  avgInputTokensPerStep: 500,
  avgOutputTokensPerStep: 300,
  costPerMillionTokens: 0.01,
  overheadMultiplier: 1.2,
};

/**
 * Estimates token usage for a plan based on step structure and complexity.
 * R8-12 FIX: Replaces the old steps.length * 1000 estimate with proper token estimation.
 */
export function estimatePlanTokens(
  plan: Plan,
  config: Partial<TokenEstimationConfig> = {},
): TokenEstimation {
  const estimationConfig = { ...DEFAULT_TOKEN_ESTIMATION_CONFIG, ...config };

  // Base calculation from step count
  const stepCount = plan.steps.length;
  const dependencyDepth = calculateDependencyDepth(plan);
  const maxConcurrency = estimateMaxConcurrency(plan);

  // Input tokens: base per step + overhead for dependencies
  const baseInputTokens = stepCount * estimationConfig.avgInputTokensPerStep;
  const dependencyOverhead = dependencyDepth * estimationConfig.avgInputTokensPerStep * 0.5;
  const inputTokens = Math.round((baseInputTokens + dependencyOverhead) * estimationConfig.overheadMultiplier);

  // Output tokens: base per step + overhead for complex plans
  const baseOutputTokens = stepCount * estimationConfig.avgOutputTokensPerStep;
  const complexityOverhead = (maxConcurrency > 1 ? maxConcurrency * 0.1 : 0) * baseOutputTokens;
  const outputTokens = Math.round((baseOutputTokens + complexityOverhead) * estimationConfig.overheadMultiplier);

  const totalTokens = inputTokens + outputTokens;
  const costEstimateUsd = (totalTokens / 1_000_000) * estimationConfig.costPerMillionTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costEstimateUsd,
  };
}

/**
 * Calculates the maximum dependency depth in a plan.
 */
function calculateDependencyDepth(plan: Plan): number {
  const stepIds = new Set(plan.steps.map((s) => s.stepId));
  const dependencyMap = new Map<string, string[]>();

  for (const step of plan.steps) {
    dependencyMap.set(step.stepId, step.dependencies ?? []);
  }

  let maxDepth = 0;
  for (const stepId of stepIds) {
    const depth = getDepth(stepId, dependencyMap, new Set<string>());
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

function getDepth(stepId: string, dependencies: Map<string, string[]>, visited: Set<string>): number {
  if (visited.has(stepId)) {
    return 0; // Circular dependency
  }
  visited.add(stepId);

  const deps = dependencies.get(stepId) ?? [];
  if (deps.length === 0) {
    return 1;
  }

  let maxChildDepth = 0;
  for (const dep of deps) {
    maxChildDepth = Math.max(maxChildDepth, getDepth(dep, dependencies, new Set(visited)));
  }

  return maxChildDepth + 1;
}

/**
 * Estimates maximum concurrency based on dependency structure.
 */
export function estimateMaxConcurrency(plan: Plan): number {
  const stepIds = plan.steps.map((s) => s.stepId);
  const inDegree = new Map<string, number>();

  // Initialize in-degrees
  for (const stepId of stepIds) {
    inDegree.set(stepId, 0);
  }

  // Count dependencies
  for (const step of plan.steps) {
    for (const dep of step.dependencies ?? []) {
      const current = inDegree.get(step.stepId) ?? 0;
      inDegree.set(step.stepId, current + 1);
    }
  }

  // Find maximum number of steps that can run concurrently
  // (steps with in-degree 0 can run in parallel)
  let maxConcurrent = 0;
  const remaining = new Set(stepIds);

  while (remaining.size > 0) {
    const readySteps = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    if (readySteps.length === 0) {
      break; // Circular dependency detected
    }
    maxConcurrent = Math.max(maxConcurrent, readySteps.length);
    for (const stepId of readySteps) {
      remaining.delete(stepId);
      // Reduce in-degree for dependent steps
      for (const step of plan.steps) {
        if ((step.dependencies ?? []).includes(stepId)) {
          const current = inDegree.get(step.stepId) ?? 0;
          inDegree.set(step.stepId, current - 1);
        }
      }
    }
  }

  return maxConcurrent;
}

export interface PlanEvaluation {
  viable: boolean;
  riskLevel: UnifiedAssessment["risk"];
  issues: string[];
  estimatedTokenBudget: number;
  estimatedCostUsd: number;
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

    // R8-12 FIX: Use proper token estimation instead of the old steps.length * 1000 estimate.
    const tokenEstimation = estimatePlanTokens(plan);
    if (tokenEstimation.totalTokens > assessment.resourceAllocation.maxTokens) {
      issues.push("planning.resource_budget_exceeded");
    }

    // R20-05: Check parallelism limit vs worker pool capacity
    const maxConcurrency = estimateMaxConcurrency(plan);
    const workerPoolCapacity = assessment.resourceAllocation.workerPoolCapacity ?? Infinity;
    if (maxConcurrency > workerPoolCapacity) {
      issues.push(`planning.parallelism_limit_exceeded:${maxConcurrency}>${workerPoolCapacity}`);
    }

    return {
      viable: issues.length === 0,
      riskLevel: assessment.risk,
      issues,
      estimatedTokenBudget: tokenEstimation.totalTokens,
      estimatedCostUsd: tokenEstimation.costEstimateUsd,
    };
  }

  public produceEvaluationReport(plan: Plan, assessment: UnifiedAssessment) {
    const evaluation = this.evaluate(plan, assessment);
    const score = Math.max(0, Math.min(1, 1 - evaluation.issues.length * 0.2));
    return {
      evaluationId: `eval_report:${plan.planId}:${Date.now()}`,
      passed: evaluation.viable,
      score,
      evaluatedAt: Date.now(),
      issues: evaluation.issues,
      recommendation: assessment.risk === "critical"
        ? "require_human_approval"
        : evaluation.issues.some((issue) => issue.includes("resource_budget_exceeded"))
          ? "reduce_scope_or_allocate_more_budget"
        : evaluation.viable
          ? "proceed_to_execute"
          : "revise_plan",
      estimatedTokenBudget: evaluation.estimatedTokenBudget,
      estimatedCostUsd: evaluation.estimatedCostUsd,
    };
  }
}
