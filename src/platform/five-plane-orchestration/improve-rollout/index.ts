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

export const StrategyVersion = "StrategyVersion";
export const AutonomyTarget = "AutonomyTarget";
export const RolloutMetrics = "RolloutMetrics";
export const ImprovementCandidate = "ImprovementCandidate";
export const RolloutRecord = "RolloutRecord";

export const CANARY_ROLLOUT_STATUSES = ["evaluation_enabled"] as const;
export const PROGRESIVE_ROLLOUT_STATUSES = ["canary_5", "partial_25", "stable_75", "stable_100", "released"] as const;
