import { z } from "zod";

export const RolloutLevelSchema = z.enum([
  "off",
  "evaluate_0",
  "canary_5",
  "partial_25",
  "stable_75",
  "stable_100",
]);
export const RolloutStatusSchema = z.enum([
  "candidate_created",
  "under_review",
  "approved",
  "evaluation_enabled",
  "canary_5",
  "partial_25",
  "stable_75",
  "stable_100",
  "released",
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
  previousLevel: RolloutLevelSchema.default("off"),
  fromLevel: RolloutLevelSchema.default("off"),
  toLevel: RolloutLevelSchema,
  strategyVersionId: z.string().nullable().default(null),
  status: RolloutStatusSchema.default("candidate_created"),
  transitionedAt: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
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
  const fromLevel = record.fromLevel ?? record.previousLevel ?? "off";
  const toLevel = record.toLevel ?? record.level ?? "off";
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
