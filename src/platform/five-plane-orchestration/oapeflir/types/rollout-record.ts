import { z } from "zod";

/**
 * R23-43 fix: Standardized rollout levels using L0-L5 naming convention.
 *
 * L0 - Off: No rollout, candidate is inactive
 * L1 - Evaluate: Initial evaluation with 0% traffic (shadow mode)
 * L2 - Canary: Canary deployment with small percentage traffic
 * L3 - Partial: Partial rollout with moderate traffic
 * L4 - Stable: Stable rollout with majority traffic
 * L5 - Full: Full rollout with 100% traffic
 *
 * The old naming (canary_5, partial_25, stable_75, stable_100) is deprecated
 * but maintained for backward compatibility in RolloutStatus.
 */
export const RolloutLevelSchema = z.enum([
  "L0_off",
  "L1_evaluate",
  "L2_canary",
  "L3_partial",
  "L4_stable",
  "L5_full",
  "off",
  "suggest",
  "shadow",
  "evaluate_0",
  "canary_5",
  "partial_25",
  "partial_50",
  "partial_75",
  "stable",
  "stable_75",
  "stable_100",
]);

// Deprecated aliases for backward compatibility
export const DEPRECATED_ROLLOUT_LEVEL_ALIASES: Record<string, RolloutLevel> = {
  "off": "L0_off",
  "suggest": "L1_evaluate",
  "shadow": "L1_evaluate",
  "evaluate_0": "L1_evaluate",
  "canary_5": "L2_canary",
  "partial_25": "L3_partial",
  "partial_50": "L3_partial",
  "partial_75": "L4_stable",
  "stable": "L5_full",
  "stable_75": "L4_stable",
  "stable_100": "L5_full",
};

/**
 * Maps deprecated level names to standardized L0-L5 levels.
 * @deprecated Use standardized L0-L5 levels instead
 */
export function normalizeRolloutLevel(level: string): RolloutLevel {
  const normalized = DEPRECATED_ROLLOUT_LEVEL_ALIASES[level];
  if (normalized != null) {
    return normalized;
  }
  if (RolloutLevelSchema.options.includes(level as RolloutLevel)) {
    return level as RolloutLevel;
  }
  return "L0_off"; // Default to L0 for unknown levels
}
export const RolloutStatusSchema = z.enum([
  "proposed",
  "evaluating",
  "draft",
  "pending_approval",
  "shadow",
  "candidate_created",
  "under_review",
  "approved",
  "accepted",
  "shadow_running",
  "evaluation_enabled",
  "canary_5",
  "partial_25",
  "partial_50",
  "partial_75",
  "stable",
  "stable_75",
  "stable_100",
  "released",
  "deployed",
  "rejected",
  "rolled_back",
  "paused",
]);

export const RolloutMetricsSchema = z.object({
  errorRate: z.number().min(0).max(1),
  latencyP99: z.number().nonnegative(),
  successRate: z.number().min(0).max(1),
  sampleCount: z.number().int().nonnegative(),
});

export const RolloutAuditContextSchema = z.object({
  actorId: z.string().optional(),
  approvedBy: z.string().optional(),
  evidenceRefs: z.array(z.string()).default([]),
  reasonCodes: z.array(z.string()).default([]),
});

export const RolloutRecordSchema = z.object({
  recordId: z.string().min(1),
  candidateId: z.string().min(1),
  level: RolloutLevelSchema,
  previousLevel: RolloutLevelSchema.default("L0_off"),
  fromLevel: RolloutLevelSchema.default("L0_off"),
  toLevel: RolloutLevelSchema.optional(),
  strategyVersionId: z.string().nullable().default(null),
  status: RolloutStatusSchema.default("candidate_created"),
  transitionedAt: z.number().int().nonnegative(),
  createdAt: z.string().min(1).optional(),
  approvedBy: z.string().optional(),
  triggeredBy: z.enum(["scheduler", "human", "auto_rollback"]).default("scheduler"),
  triggerReason: z.string().optional(),
  metrics: RolloutMetricsSchema.default({
    errorRate: 0,
    latencyP99: 0,
    successRate: 1,
    sampleCount: 0,
  }),
  auditContext: RolloutAuditContextSchema.default({
    evidenceRefs: [],
    reasonCodes: [],
  }),
  guardrailReasonCodes: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
});

export type RolloutLevel = z.infer<typeof RolloutLevelSchema>;
export type RolloutStatus = z.infer<typeof RolloutStatusSchema>;
export type RolloutMetrics = z.infer<typeof RolloutMetricsSchema>;
export type RolloutAuditContext = z.infer<typeof RolloutAuditContextSchema>;
export type RolloutRecord = z.infer<typeof RolloutRecordSchema>;

export function parseRolloutRecord(input: unknown): RolloutRecord {
  const record = (input ?? {}) as Partial<RolloutRecord>;
  const fromLevel = record.fromLevel ?? record.previousLevel ?? "L0_off";
  const toLevel = record.toLevel ?? record.level ?? "L0_off";
  const transitionedAt = record.transitionedAt ?? Date.now();
  const guardrailReasonCodes = record.guardrailReasonCodes ?? [];
  const evidence = record.evidence ?? [];
  return RolloutRecordSchema.parse({
    ...record,
    previousLevel: fromLevel,
    fromLevel,
    toLevel,
    level: toLevel,
    createdAt: record.createdAt ?? new Date(transitionedAt).toISOString(),
    metrics: record.metrics ?? {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    auditContext: record.auditContext ?? {
      ...(record.approvedBy == null ? {} : { approvedBy: record.approvedBy }),
      evidenceRefs: evidence,
      reasonCodes: guardrailReasonCodes,
    },
  });
}
