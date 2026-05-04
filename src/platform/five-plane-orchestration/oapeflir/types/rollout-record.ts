import { z } from "zod";
import { ImprovementGuardrailSchema } from "./improvement-candidate.js";

export const RolloutLevelSchema = z.enum([
  "off",
  "evaluate_0",
  "canary_5",
  "canary_20",
  "canary_50",
  "stable_100",
]);
export const RolloutStatusSchema = z.enum([
  "candidate_created",
  "under_review",
  "draft",
  "pending_approval",
  "rejected",
  "evaluation_enabled",
  "canary_5",
  "canary_20",
  "canary_50",
  "stable_100",
  "released",
  "rolled_back",
  "paused",
]);

export const RolloutMetricsSchema = z.object({
  errorRate: z.number().nonnegative(),
  latencyP99: z.number().nonnegative(),
  successRate: z.number().min(0).max(1),
  sampleCount: z.number().int().nonnegative(),
});

export const AuditContextSchema = z.object({
  userId: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const RolloutRecordSchema = z.object({
  recordId: z.string().min(1),
  candidateId: z.string().min(1),
  fromLevel: RolloutLevelSchema,
  toLevel: RolloutLevelSchema,
  previousLevel: RolloutLevelSchema.default("off"),
  strategyVersionId: z.string().nullable().default(null),
  status: RolloutStatusSchema.default("draft"),
  triggeredBy: z.enum(["scheduler", "human", "auto_rollback"]).default("human"),
  triggerReason: z.string().optional(),
  transitionedAt: z.number().int().nonnegative(),
  approvedBy: z.string().optional(),
  guardrailReasonCodes: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  metrics: RolloutMetricsSchema.nullable().default(null),
  auditContext: AuditContextSchema.default({}),
});

export type RolloutLevel = z.infer<typeof RolloutLevelSchema>;
export type RolloutStatus = z.infer<typeof RolloutStatusSchema>;
export type RolloutMetrics = z.infer<typeof RolloutMetricsSchema>;
export type AuditContext = z.infer<typeof AuditContextSchema>;
export type RolloutRecord = z.infer<typeof RolloutRecordSchema>;

export function parseRolloutRecord(input: unknown): RolloutRecord {
  return RolloutRecordSchema.parse(input);
}
