import { createHash } from "node:crypto";

import { z } from "zod";

import { stableStringify } from "./stable-stringify.js";

const isoString = z.string().min(1);
const refString = z.string().min(1);
const comparableValueSchema = z.union([z.number(), z.string(), z.boolean()]);
const comparisonOperatorSchema = z.enum(["==", "!=", ">=", ">", "<=", "<"]);
// Keep the playbook leaf contract free of the mission barrel to avoid an ESM
// initialization cycle when mission/index.ts re-exports this module.
const MissionPlaybookMissionTypeSchema = z.enum([
  "ad_hoc",
  "formal",
  "program",
  "incident",
  "scheduled",
  "benchmark_monitoring",
]);
const MissionPlaybookStatusSchema = z.enum([
  "draft",
  "validated",
  "validation_failed",
  "rejected",
  "canary",
  "active",
  "suspended",
  "deprecated",
  "revoked",
  "archived",
]);
const PlaybookFallbackPolicySchema = z.enum(["fail_closed", "use_last_active", "manual_selection"]);

export const MissionPlaybookCompatibilitySchema = z.object({
  minPlatformVersion: refString,
  compatibleMissionSchemaVersions: z.array(refString).min(1),
  authorizedTenantIds: z.array(refString).optional(),
}).strict();
export type MissionPlaybookCompatibility = z.infer<typeof MissionPlaybookCompatibilitySchema>;

export const MissionPlaybookRolloutSchema = z.object({
  mode: z.enum(["manual", "canary", "full"]),
  percentage: z.number().int().min(0).max(100),
  targetTenants: z.array(refString),
  rolloutRef: refString,
}).strict();
export type MissionPlaybookRollout = z.infer<typeof MissionPlaybookRolloutSchema>;

export const MissionPlaybookSignatureSchema = z.object({
  signedBy: refString,
  signatureRef: refString,
  signedAt: isoString,
}).strict();
export type MissionPlaybookSignature = z.infer<typeof MissionPlaybookSignatureSchema>;

export const MissionPlaybookRollbackSchema = z.object({
  previousVersion: refString.nullable(),
  rollbackAllowed: z.boolean(),
  rollbackRef: refString,
}).strict();
export type MissionPlaybookRollback = z.infer<typeof MissionPlaybookRollbackSchema>;

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
  status: MissionPlaybookStatusSchema,
  entryStageId: refString,
  stages: z.array(MissionPlaybookStageSchema).min(1),
  edges: z.array(MissionStageEdgeSchema),
  compatibility: MissionPlaybookCompatibilitySchema.nullable(),
  rollout: MissionPlaybookRolloutSchema.nullable(),
  signature: MissionPlaybookSignatureSchema.nullable(),
  rollback: MissionPlaybookRollbackSchema.nullable(),
  signatureRef: refString.nullable(),
  rollbackRef: refString.nullable(),
  compatibilityRef: refString.nullable(),
  createdAt: isoString,
  updatedAt: isoString,
}).strict().superRefine((playbook, ctx) => {
  if ((playbook.status === "active" || playbook.status === "canary")) {
    if (playbook.compatibility == null || playbook.compatibilityRef == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compatibility"],
        message: "Active or canary playbooks require compatibility metadata and compatibilityRef",
      });
    }
    if (playbook.signature == null || playbook.signatureRef == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signature"],
        message: "Active or canary playbooks require signature metadata and signatureRef",
      });
    }
    if (playbook.rollback == null || playbook.rollbackRef == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rollback"],
        message: "Active or canary playbooks require rollback metadata and rollbackRef",
      });
    }
  }
  if (playbook.signature != null && playbook.signatureRef != null && playbook.signature.signatureRef !== playbook.signatureRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["signatureRef"],
      message: "signatureRef must match signature.signatureRef",
    });
  }
  if (playbook.rollback != null && playbook.rollbackRef != null && playbook.rollback.rollbackRef !== playbook.rollbackRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rollbackRef"],
      message: "rollbackRef must match rollback.rollbackRef",
    });
  }
  if (playbook.status === "canary") {
    if (playbook.rollout == null || playbook.rollout.mode !== "canary") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rollout"],
        message: "Canary playbooks require canary rollout metadata",
      });
    }
    if (playbook.rollout != null && playbook.rollout.percentage === 100 && playbook.rollout.targetTenants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rollout", "percentage"],
        message: "Canary playbooks must not default to all tenants",
      });
    }
  }
});
export type MissionPlaybook = z.infer<typeof MissionPlaybookSchema>;

export const MissionPlaybookResolutionPolicySchema = z.object({
  missionType: MissionPlaybookMissionTypeSchema,
  tenantId: refString,
  requestedPlaybookId: refString.optional(),
  requestedVersion: refString.optional(),
  allowCanary: z.boolean(),
  tenantOverrideAllowed: z.boolean(),
  fallbackPolicy: PlaybookFallbackPolicySchema,
}).strict();
export type MissionPlaybookResolutionPolicy = z.infer<typeof MissionPlaybookResolutionPolicySchema>;

export const MissionPlaybookResolutionResultSchema = z.object({
  playbookId: refString,
  playbookVersion: refString,
  resolutionReason: z.enum([
    "explicit_request",
    "tenant_override",
    "canary_rollout",
    "default_active",
    "last_active_fallback",
  ]),
  rolloutRef: refString.optional(),
  auditRef: refString,
}).strict();
export type MissionPlaybookResolutionResult = z.infer<typeof MissionPlaybookResolutionResultSchema>;

export const MissionPlaybookMigrationPlanSchema = z.object({
  migrationPlanId: refString,
  fromPlaybookId: refString,
  fromVersion: refString,
  toPlaybookId: refString,
  toVersion: refString,
  affectedMissionIds: z.array(refString),
  migrationMode: z.enum(["hold_then_manual", "auto_if_compatible", "terminate_and_recreate"]),
  compatibilityReportRef: refString,
  approvalRef: refString.optional(),
  rollbackPlanRef: refString,
  auditRef: refString,
  createdAt: isoString,
}).strict();
export type MissionPlaybookMigrationPlan = z.infer<typeof MissionPlaybookMigrationPlanSchema>;

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
