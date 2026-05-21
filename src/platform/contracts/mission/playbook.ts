import { createHash } from "node:crypto";

import { z } from "zod";

const isoString = z.string().min(1);
const refString = z.string().min(1);
const comparableValueSchema = z.union([z.number(), z.string(), z.boolean()]);
const comparisonOperatorSchema = z.enum(["==", "!=", ">=", ">", "<=", "<"]);
// Keep the playbook leaf contract free of the mission barrel to avoid an ESM
// initialization cycle when mission/index.ts re-exports this module.
const MissionPlaybookMissionTypeSchema = z.enum(["ad_hoc", "formal", "program", "incident", "scheduled"]);

export const MissionStageStatusSchema = z.enum([
  "pending",
  "active",
  "exit_evaluating",
  "held",
  "blocked",
  "completed",
  "terminated",
]);
export type MissionStageStatus = z.infer<typeof MissionStageStatusSchema>;

export const BoundedTimeWindowSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("duration"),
    iso8601: refString,
    maxDurationMs: z.number().int().positive(),
  }).strict(),
  z.object({
    type: z.literal("stage"),
    stageInstanceId: refString,
    maxDurationMs: z.number().int().positive(),
  }).strict(),
  z.object({
    type: z.literal("mission"),
    missionId: refString,
    maxDurationMs: z.number().int().positive(),
  }).strict(),
]);
export type BoundedTimeWindow = z.infer<typeof BoundedTimeWindowSchema>;

export type ExitCriterionExpression =
  | {
      readonly type: "metric_threshold";
      readonly metric: string;
      readonly operator: z.infer<typeof comparisonOperatorSchema>;
      readonly value: z.infer<typeof comparableValueSchema>;
      readonly window?: BoundedTimeWindow | undefined;
    }
  | {
      readonly type: "event_count";
      readonly eventName: string;
      readonly operator: z.infer<typeof comparisonOperatorSchema>;
      readonly value: number;
      readonly window?: BoundedTimeWindow | undefined;
    }
  | {
      readonly type: "evidence_exists";
      readonly evidenceKind: string;
      readonly minCount?: number | undefined;
    }
  | {
      readonly type: "hitl_decision";
      readonly decisionType: string;
      readonly requiredDecision: "approved" | "rejected" | "request_changes";
    }
  | {
      readonly type: "all_of" | "any_of";
      readonly criteria: readonly ExitCriterionExpression[];
    }
  | {
      readonly type: "not";
      readonly criterion: ExitCriterionExpression;
    };

export const ExitCriterionExpressionSchema: z.ZodType<ExitCriterionExpression> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("metric_threshold"),
      metric: refString,
      operator: comparisonOperatorSchema,
      value: comparableValueSchema,
      window: BoundedTimeWindowSchema.optional(),
    }).strict(),
    z.object({
      type: z.literal("event_count"),
      eventName: refString,
      operator: comparisonOperatorSchema,
      value: z.number().int().nonnegative(),
      window: BoundedTimeWindowSchema.optional(),
    }).strict(),
    z.object({
      type: z.literal("evidence_exists"),
      evidenceKind: refString,
      minCount: z.number().int().positive().optional(),
    }).strict(),
    z.object({
      type: z.literal("hitl_decision"),
      decisionType: refString,
      requiredDecision: z.enum(["approved", "rejected", "request_changes"]),
    }).strict(),
    z.object({
      type: z.literal("all_of"),
      criteria: z.array(ExitCriterionExpressionSchema).min(1),
    }).strict(),
    z.object({
      type: z.literal("any_of"),
      criteria: z.array(ExitCriterionExpressionSchema).min(1),
    }).strict(),
    z.object({
      type: z.literal("not"),
      criterion: ExitCriterionExpressionSchema,
    }).strict(),
  ]),
);

export const ExitCriterionSchema = z.object({
  criterionId: refString,
  name: refString,
  severity: z.enum(["P0", "P1", "P2"]),
  gateId: refString,
  expression: ExitCriterionExpressionSchema,
  requiredEvidenceRefs: z.array(refString),
  requiredMetricRefs: z.array(refString),
  failureModeRef: refString.optional(),
}).strict();
export type ExitCriterion = z.infer<typeof ExitCriterionSchema>;

export const MissionStageInstanceSchema = z.object({
  stageInstanceId: refString,
  missionId: refString,
  playbookId: refString,
  playbookVersion: refString,
  stageId: refString,
  cycleIndex: z.number().int().nonnegative(),
  parentStageInstanceId: refString.optional(),
  status: MissionStageStatusSchema,
  version: z.number().int().nonnegative(),
  enteredAt: isoString,
  exitedAt: isoString.optional(),
}).strict();
export type MissionStageInstance = z.infer<typeof MissionStageInstanceSchema>;

export const MissionPlaybookStageSchema = z.object({
  stageId: refString,
  title: refString,
  exitCriteria: z.array(ExitCriterionSchema).min(1),
  failureModeRefs: z.array(refString),
  defaultSkillRefs: z.array(refString),
  evidenceRequirements: z.array(refString),
}).strict();
export type MissionPlaybookStage = z.infer<typeof MissionPlaybookStageSchema>;

export const MissionStageEdgeSchema = z.object({
  edgeId: refString,
  fromStageId: refString,
  toStageId: refString,
  requiredGateIds: z.array(refString),
  requiresHitl: z.boolean(),
  requiredCapabilities: z.array(refString),
}).strict();
export type MissionStageEdge = z.infer<typeof MissionStageEdgeSchema>;

export const MissionPlaybookSchema = z.object({
  playbookId: refString,
  version: refString,
  missionType: MissionPlaybookMissionTypeSchema,
  title: refString,
  owner: refString,
  status: z.enum(["draft", "validated", "active", "suspended", "deprecated", "revoked", "archived"]),
  entryStageId: refString,
  stages: z.array(MissionPlaybookStageSchema).min(1),
  edges: z.array(MissionStageEdgeSchema),
  signatureRef: refString.nullable(),
  rollbackRef: refString.nullable(),
  compatibilityRef: refString.nullable(),
  createdAt: isoString,
  updatedAt: isoString,
}).strict();
export type MissionPlaybook = z.infer<typeof MissionPlaybookSchema>;

export const StageExitSnapshotSchema = z.object({
  metricValues: z.record(comparableValueSchema),
  eventCounts: z.record(z.number().int().nonnegative()),
  evidenceCounts: z.record(z.number().int().nonnegative()),
  hitlDecisions: z.record(z.enum(["approved", "rejected", "request_changes"])),
  snapshotRefs: z.array(refString),
}).strict();
export type StageExitSnapshot = z.infer<typeof StageExitSnapshotSchema>;

export const ExitCriterionEvaluationResultSchema = z.object({
  criterionId: refString,
  expressionHash: refString,
  passed: z.boolean(),
  actualValue: comparableValueSchema.nullable(),
  expectedValue: comparableValueSchema.nullable(),
  snapshotRefs: z.array(refString),
  evidenceRefs: z.array(refString),
  reasonCode: refString.optional(),
}).strict();
export type ExitCriterionEvaluationResult = z.infer<typeof ExitCriterionEvaluationResultSchema>;

export const StageExitDecisionSchema = z.object({
  decisionId: refString,
  missionId: refString,
  stageInstanceId: refString,
  stageId: refString,
  playbookId: refString,
  playbookVersion: refString,
  decision: z.enum(["advance", "hold", "require_hitl", "terminate"]),
  targetStageId: refString.nullable(),
  criterionResults: z.array(ExitCriterionEvaluationResultSchema),
  failedCriterionIds: z.array(refString),
  requiredActions: z.array(refString),
  evaluatedAt: isoString,
}).strict();
export type StageExitDecision = z.infer<typeof StageExitDecisionSchema>;

export function hashExitCriterionExpression(expression: ExitCriterionExpression): string {
  return createHash("sha256").update(stableStringify(expression)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
