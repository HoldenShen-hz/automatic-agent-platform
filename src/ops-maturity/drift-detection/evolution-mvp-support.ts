/**
 * Evolution MVP Service
 *
 * Manages the lifecycle of evolution proposals including budget adjustments and experience promotion.
 * Proposals go through a workflow: create -> pending approval -> approved -> applied -> rolled back.
 * Budget adjustments modify cost policies based on observed spending patterns.
 * Experience promotion elevates successful task patterns into reusable structured memory.
 */

import type {
  EvolutionLogRecord,
  EvolutionPolicyRecord,
  EvolutionProposalRecord,
  EvolutionScopeType,
} from "../../platform/contracts/types/domain.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import type { BudgetPolicy } from "../../platform/model-gateway/cost-tracker/budget-guard.js";
import type { ApprovalRequest } from "../../platform/five-plane-control-plane/approval-center/approval-service.js";

/**
 * Evidence supporting a budget adjustment proposal.
 * Contains both the current policy and the recommended policy along with observed metrics.
 */
export interface BudgetAdjustmentEvidence {
  currentPolicy: BudgetPolicy;
  recommendedPolicy: BudgetPolicy;
  observedAverageCostUsd: number;
  sampleSize: number;
  successRate: number;
  proposalReason: string;
}

/**
 * Evidence supporting an experience promotion proposal.
 * Contains the matched experience and similarity metrics used to justify promotion.
 */
export interface ExperiencePromotionEvidence {
  taskContext: string;
  taskIntent: string;
  queryTools: readonly string[];
  matchedExperienceId: string;
  similarityScore: number;
  matchedKeywords: readonly string[];
  proposedSummary: string;
}

/**
 * Payload for a budget adjustment evolution proposal.
 */
export interface BudgetAdjustmentProposalPayload {
  kind: "budget_adjustment";
  recommendedPolicy: BudgetPolicy;
  baselinePolicy: BudgetPolicy;
  observedAverageCostUsd: number;
  sampleSize: number;
  successRate: number;
  proposalReason: string;
}

/**
 * Payload for an experience promotion evolution proposal.
 */
export interface ExperiencePromotionProposalPayload {
  kind: "experience_promotion";
  sourceExperienceId: string;
  sourceTaskContext: string;
  sourceTaskIntent: string;
  targetScope: string;
  promotedSummary: string;
  qualityScore: number;
  matchedKeywords: readonly string[];
}

/**
 * Union type of all evolution proposal payloads.
 */
export type EvolutionProposalPayload =
  | BudgetAdjustmentProposalPayload
  | ExperiencePromotionProposalPayload;

/**
 * Complete view of an evolution proposal including its approval status, active policy, and audit logs.
 */
export interface EvolutionProposalView {
  proposal: EvolutionProposalRecord;
  approval: ApprovalRequest | null;
  activePolicy: EvolutionPolicyRecord | null;
  logs: EvolutionLogRecord[];
}

/**
 * Input for proposing a budget adjustment evolution.
 */
export interface ProposeBudgetAdjustmentInput {
  taskId: string;
  executionId?: string | null;
  sourceAgentId: string;
  scopeType: EvolutionScopeType;
  scopeRef: string;
  currentPolicy: BudgetPolicy;
  observedAverageCostUsd: number;
  sampleSize: number;
  successRate: number;
  proposalReason: string;
}

/**
 * Input for proposing an experience promotion evolution.
 */
export interface ProposeExperiencePromotionInput {
  taskId: string;
  executionId?: string | null;
  sourceAgentId: string;
  scopeType: EvolutionScopeType;
  scopeRef: string;
  targetScope: string;
  taskContext: string;
  taskIntent: string;
  queryTools?: readonly string[];
  minQualityScore?: number;
}

/**
 * Input for applying an approved evolution proposal.
 */
export interface ApplyEvolutionProposalInput {
  proposalId: string;
  appliedBy: string;
  appliedAt?: string;
}

/**
 * Input for rolling back an applied evolution proposal.
 */
export interface RollbackEvolutionProposalInput {
  proposalId: string;
  rolledBackBy: string;
  reasonCode: string;
  rolledBackAt?: string;
}

/** Pattern for validating scope reference format */
const SCOPE_REF_PATTERN = /^[a-zA-Z][a-zA-Z0-9._:-]{1,127}$/;

/**
 * Validates that a scope reference conforms to the expected format.
 */
export function assertEvolutionScope(scopeType: EvolutionScopeType, scopeRef: string): void {
  if (!SCOPE_REF_PATTERN.test(scopeRef)) {
    throw new ValidationError(`evolution.invalid_scope_ref:${scopeType}`, `evolution.invalid_scope_ref:${scopeType}`, {
      retryable: false,
      details: { scopeType, scopeRef },
    });
  }
}

/**
 * Rounds a currency value to 4 decimal places to avoid floating point issues.
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Rounds a ratio value to 3 decimal places.
 */
export function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Clamps a value between minimum and maximum bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generates a human-readable summary for a budget adjustment proposal.
 */
export function summarizeBudgetProposal(
  scopeType: EvolutionScopeType,
  scopeRef: string,
  evidence: BudgetAdjustmentEvidence,
): string {
  return [
    `Apply conservative budget adjustment for ${scopeType}:${scopeRef}.`,
    `Observed avg spend ${evidence.observedAverageCostUsd.toFixed(4)} USD across ${evidence.sampleSize} samples.`,
    `Target maxTaskCostUsd ${evidence.currentPolicy.maxTaskCostUsd.toFixed(4)} -> ${evidence.recommendedPolicy.maxTaskCostUsd.toFixed(4)}.`,
  ].join(" ");
}

/**
 * Computes a recommended budget policy based on observed spending patterns.
 * Increases limits when spending is near limits with good success rate.
 * Decreases limits when spending is well below limits consistently.
 */
export function buildRecommendedBudgetPolicy(input: ProposeBudgetAdjustmentInput): BudgetPolicy {
  if (input.sampleSize < 3) {
    throw new ValidationError("evolution.insufficient_budget_samples", "evolution.insufficient_budget_samples", {
      retryable: false,
      details: { sampleSize: input.sampleSize },
    });
  }
  if (!(input.successRate >= 0 && input.successRate <= 1)) {
    throw new ValidationError("evolution.invalid_success_rate", "evolution.invalid_success_rate", {
      retryable: false,
      details: { successRate: input.successRate },
    });
  }
  if (input.observedAverageCostUsd <= 0) {
    throw new ValidationError("evolution.invalid_observed_cost", "evolution.invalid_observed_cost", {
      retryable: false,
      details: { observedAverageCostUsd: input.observedAverageCostUsd },
    });
  }

  const baseline = input.currentPolicy;
  const observed = input.observedAverageCostUsd;
  const increaseTarget = observed * 1.15;
  const decreaseTarget = observed * 1.2;

  let nextMaxTaskCostUsd = baseline.maxTaskCostUsd;
  if (observed > baseline.maxTaskCostUsd * 0.85 && input.successRate >= 0.6) {
    nextMaxTaskCostUsd = Math.min(baseline.maxTaskCostUsd * 1.25, increaseTarget);
  } else if (observed < baseline.maxTaskCostUsd * 0.45 && input.sampleSize >= 5) {
    nextMaxTaskCostUsd = Math.max(baseline.maxTaskCostUsd * 0.8, decreaseTarget);
  }

  return {
    ...baseline,
    maxTaskCostUsd: roundCurrency(clamp(nextMaxTaskCostUsd, baseline.maxTaskCostUsd * 0.8, baseline.maxTaskCostUsd * 1.25)),
    warnAtRatio: roundRatio(clamp(baseline.warnAtRatio, 0.65, 0.95)),
  };
}

/**
 * Parses the JSON payload from an evolution proposal record.
 */
export function parseProposalPayload(record: EvolutionProposalRecord): EvolutionProposalPayload {
  return JSON.parse(record.proposalJson) as EvolutionProposalPayload;
}

/**
 * Parses the JSON value from an evolution policy record.
 */
export function parsePolicyValue<T>(record: EvolutionPolicyRecord): T {
  return JSON.parse(record.valueJson) as T;
}

/**
 * Service managing the lifecycle of evolution proposals.
 *
 * Evolution proposals allow the system to adapt its behavior over time:
 * - Budget adjustments modify cost policies based on observed spending
 * - Experience promotion captures successful task patterns for reuse
 *
 * Proposals require approval before being applied and can be rolled back.
 */
