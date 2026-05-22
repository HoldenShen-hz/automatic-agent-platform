export * from "./strategy-versioning.js";
export * from "./autonomy-boundary-policy.js";
export * from "./improvement-candidate-registry.js";
export * from "./guardrail-evaluator.js";
export * from "./policy-rollout-service.js";
export * from "./auto-rollback-service.js";
export * from "./canary-traffic-router.js";
export * from "./rollout/rollout-state-machine.js";
export * from "./rollout/rollout-scheduler.js";
export * from "./release-policy.js";
export { ImprovementCandidateSchema } from "../oapeflir/types/improvement-candidate.js";

export const StrategyVersion = "StrategyVersion";
export const AutonomyTarget = "AutonomyTarget";
export const RolloutMetrics = "RolloutMetrics";
export const ImprovementCandidate = "ImprovementCandidate";
export const RolloutRecord = "RolloutRecord";
export const ReleasePolicy = "ReleasePolicy";
export class StrategyVersioning {}
export const AutonomyBoundary = "AutonomyBoundary";
export const RolloutStage = "RolloutStage";
export const RolloutResult = "RolloutResult";
export const GuardrailCheck = "GuardrailCheck";
export const RollbackTrigger = "RollbackTrigger";
export const ReleasePolicySchema = "ReleasePolicySchema";
export const GuardrailEvaluatorSchema = "GuardrailEvaluatorSchema";
export const CanaryRouterSchema = "CanaryRouterSchema";
export const RolloutStateMachineSchema = "RolloutStateMachineSchema";
export const StrategyVersioningSchema = "StrategyVersioningSchema";

export const CANARY_ROLLOUT_LEVELS = ["L1_evaluate", "L2_canary"] as const;
export const PROGRESSIVE_ROLLOUT_LEVELS = ["L2_canary", "L3_partial", "L4_stable", "L5_full"] as const;

/** @deprecated Prefer canonical L0-L5 rollout levels. */
export const CANARY_ROLLOUT_STATUSES = ["evaluation_enabled"] as const;
/** @deprecated Prefer canonical L0-L5 rollout levels. */
export const PROGRESSIVE_ROLLOUT_STATUSES = ["canary_5", "partial_25", "stable_75", "stable_100", "released"] as const;
/** @deprecated Kept for historical misspelled imports. */
export const PROGRESIVE_ROLLOUT_STATUSES = PROGRESSIVE_ROLLOUT_STATUSES;
