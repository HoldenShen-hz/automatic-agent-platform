import { createHash } from "node:crypto";

import { z } from "zod";

import type { JsonValue, PrincipalRef, RiskClass } from "../executable-contracts/index.js";
import { stableStringify } from "./stable-stringify.js";

export const MissionStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "frozen",
  "completed",
  "archived",
]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

export const MissionTypeSchema = z.enum(["ad_hoc", "formal", "program", "incident", "scheduled", "benchmark_monitoring"]);
export type MissionType = z.infer<typeof MissionTypeSchema>;

export const MissionPrioritySchema = z.enum(["low", "normal", "high", "critical"]);
export type MissionPriority = z.infer<typeof MissionPrioritySchema>;

export const MissionPermissionSchema = z.enum([
  "mission:read",
  "mission:update",
  "mission:manage_members",
  "mission:view_budget",
  "mission:view_evidence",
  "mission:bind_task",
  "mission:execute",
  "mission:handoff",
]);
export type MissionPermission = z.infer<typeof MissionPermissionSchema>;

export const MissionRoleSchema = z.enum(["owner", "admin", "operator", "viewer", "auditor"]);
export type MissionRole = z.infer<typeof MissionRoleSchema>;

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]) as z.ZodType<JsonValue>,
);

const isoString = z.string().min(1);

export const RuntimeConstraintSetSchema = z.object({
  allowAutoExecute: z.boolean(),
  requireHITL: z.boolean(),
  allowExternalNetwork: z.boolean(),
  allowSideEffectCommit: z.boolean(),
  maxDelegationDepth: z.number().int().nonnegative(),
  maxParallelNodeRuns: z.number().int().positive(),
  requireBudgetReservation: z.boolean(),
  requireEvidenceRefs: z.boolean(),
  allowModelCall: z.boolean(),
  allowToolCall: z.boolean(),
  allowFileWrite: z.boolean(),
  allowDestructiveAction: z.boolean(),
  requireDomainOwnerApproval: z.boolean(),
  deniedToolNames: z.array(z.string()),
  deniedDomains: z.array(z.string()),
  dataResidency: z.array(z.string()),
  modelTrainingOptOut: z.boolean(),
}).strict();
export type RuntimeConstraintSet = z.infer<typeof RuntimeConstraintSetSchema>;

export const MissionBudgetEnvelopeSchema = z.object({
  budgetEnvelopeId: z.string().min(1),
  missionId: z.string().min(1),
  currency: z.string().min(1),
  hardCap: z.number().nonnegative(),
  reservedAmount: z.number().nonnegative(),
  settledAmount: z.number().nonnegative(),
  releasedAmount: z.number().nonnegative(),
  version: z.number().int().nonnegative(),
}).strict();
export type MissionBudgetEnvelope = z.infer<typeof MissionBudgetEnvelopeSchema>;

export const MissionPlaybookBindingSchema = z.object({
  playbookId: z.string().min(1),
  playbookVersion: z.string().min(1),
  resolutionAuditRef: z.string().min(1),
  lockedAt: isoString,
  lockedBy: z.string().min(1),
  migrationPlanRefs: z.array(z.string().min(1)),
}).strict();
export type MissionPlaybookBinding = z.infer<typeof MissionPlaybookBindingSchema>;

export const MissionRecordSchema = z.object({
  missionId: z.string().min(1),
  tenantId: z.string().min(1),
  orgId: z.string().min(1).nullable(),
  type: MissionTypeSchema,
  status: MissionStatusSchema,
  priority: MissionPrioritySchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  objective: z.string().min(1),
  successCriteria: z.array(z.string()).min(1),
  ownerPrincipalId: z.string().min(1),
  accountablePrincipalId: z.string().min(1).nullable(),
  domainId: z.string().min(1).nullable(),
  policyRefs: z.array(z.string()),
  riskProfileRef: z.string().min(1).nullable(),
  budgetEnvelopeRef: z.string().min(1).nullable(),
  knowledgeBoundaryRef: z.string().min(1).nullable(),
  playbookBinding: MissionPlaybookBindingSchema.optional(),
  defaultWorkflowTemplateRefs: z.array(z.string()),
  metadata: JsonValueSchema,
  freezeReason: z.string().min(1).nullable(),
  createdAt: isoString,
  createdBy: z.string().min(1),
  updatedAt: isoString,
  updatedBy: z.string().min(1),
  archivedAt: isoString.nullable(),
  archivedBy: z.string().min(1).nullable(),
  version: z.number().int().nonnegative(),
  etag: z.string().min(1),
}).strict();
export type MissionRecord = z.infer<typeof MissionRecordSchema>;

export const MissionMembershipSchema = z.object({
  membershipId: z.string().min(1),
  missionId: z.string().min(1),
  tenantId: z.string().min(1),
  principalType: z.enum(["user", "service", "agent", "team"]),
  principalId: z.string().min(1),
  role: MissionRoleSchema,
  permissions: z.array(MissionPermissionSchema),
  deniedPermissions: z.array(MissionPermissionSchema),
  status: z.enum(["active", "revoked", "expired"]),
  grantedBy: z.string().min(1),
  grantedAt: isoString,
  expiresAt: isoString.nullable(),
  metadata: JsonValueSchema,
  version: z.number().int().nonnegative(),
}).strict();
export type MissionMembership = z.infer<typeof MissionMembershipSchema>;

export const MissionContextSnapshotSchema = z.object({
  missionSnapshotId: z.string().min(1),
  missionId: z.string().min(1),
  missionVersion: z.number().int().nonnegative(),
  tenantId: z.string().min(1),
  orgId: z.string().min(1).nullable(),
  taskId: z.string().min(1),
  confirmedTaskSpecId: z.string().min(1),
  runtimeConstraints: RuntimeConstraintSetSchema,
  mission: MissionRecordSchema,
  memberships: z.array(MissionMembershipSchema),
  payloadHash: z.string().min(1),
  signature: z.string().min(1).nullable(),
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  createdAt: isoString,
  createdBy: z.string().min(1),
}).strict();
export type MissionContextSnapshot = z.infer<typeof MissionContextSnapshotSchema>;

export const MissionRefSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("use_existing"), missionId: z.string().min(1) }).strict(),
  z.object({
    mode: z.literal("auto_resolve"),
    allowAdHoc: z.boolean(),
    createFormalMissionWhen: z.enum(["never", "multi_task_or_high_risk", "always"]),
    missionHint: z.string().min(1).optional(),
  }).strict(),
]);
export type MissionRef = z.infer<typeof MissionRefSchema>;

export const MissionBindingSchema = z.object({
  missionId: z.string().min(1),
  missionSnapshotId: z.string().min(1),
  missionVersion: z.number().int().nonnegative(),
  boundAt: isoString,
  boundBy: z.string().min(1),
}).strict();
export type MissionBinding = z.infer<typeof MissionBindingSchema>;

export const MissionResolutionRequestSchema = z.object({
  tenantId: z.string().min(1),
  sessionId: z.string().min(1).nullable().optional(),
  confirmedTaskSpecId: z.string().min(1),
  principal: z.object({
    principalId: z.string().min(1),
    type: z.enum(["human", "agent", "system", "service", "tool", "organization"]).default("human"),
    tenantId: z.string().min(1),
    roles: z.array(z.string()),
    displayName: z.string().optional(),
  }),
  missionRef: MissionRefSchema.optional(),
  missionHint: z.string().min(1).nullable().optional(),
  createIfMissing: z.boolean().optional(),
  goal: z.string().min(1),
  domainId: z.string().min(1).nullable().optional(),
  riskClass: z.enum(["low", "medium", "high", "critical"]),
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
}).strict();
export type MissionResolutionRequest = z.infer<typeof MissionResolutionRequestSchema>;

export const MissionResolutionResultSchema = z.object({
  resolution: z.enum(["matched_existing", "created_ad_hoc", "requires_user_choice", "rejected"]),
  missionId: z.string().min(1).nullable(),
  confidence: z.number().min(0).max(1),
  requiresUserChoice: z.boolean(),
  candidateMissionIds: z.array(z.string()),
  effectiveConstraintsPreview: RuntimeConstraintSetSchema,
  reasonCode: z.string().min(1),
}).strict();
export type MissionResolutionResult = z.infer<typeof MissionResolutionResultSchema>;

export const MissionHandoffRequestSchema = z.object({
  handoffId: z.string().min(1),
  sourceMissionId: z.string().min(1),
  targetMissionId: z.string().min(1),
  tenantId: z.string().min(1),
  requestedBy: z.string().min(1),
  approvalRef: z.string().min(1),
  budgetTransferRef: z.string().min(1).nullable(),
  auditRef: z.string().min(1),
  reason: z.string().min(1),
  createdAt: isoString,
}).strict();
export type MissionHandoffRequest = z.infer<typeof MissionHandoffRequestSchema>;

export const MissionErrorCodeSchema = z.enum([
  "mission.not_found",
  "mission.member_not_found",
  "mission.required",
  "mission.access_denied",
  "mission.state_conflict",
  "mission.if_match_required",
  "mission.version_conflict",
  "mission.policy_denied",
  "mission.budget_exhausted",
  "mission.live_guard_blocked",
]);
export type MissionErrorCode = z.infer<typeof MissionErrorCodeSchema>;

export const MissionErrorEnvelopeSchema = z.object({
  code: MissionErrorCodeSchema,
  message: z.string().min(1),
  requestId: z.string().min(1),
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  details: z.record(JsonValueSchema).optional(),
}).strict();
export type MissionErrorEnvelope = z.infer<typeof MissionErrorEnvelopeSchema>;

export const MissionEventTypeSchema = z.enum([
  "platform.mission.created",
  "platform.mission.updated",
  "platform.mission.status_changed",
  "platform.mission.bound_to_task",
  "platform.mission.snapshot_created",
  "platform.mission.membership_granted",
  "platform.mission.membership_revoked",
  "platform.mission.budget_reserved",
  "platform.mission.budget_settled",
  "platform.mission.handoff_requested",
  "platform.mission.stage_exit_evaluated",
  "platform.mission.failure_mode_detected",
  "platform.mission.outcome_measured",
]);
export type MissionEventType = z.infer<typeof MissionEventTypeSchema>;

export const MissionEventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  eventType: MissionEventTypeSchema,
  tenantId: z.string().min(1),
  aggregateType: z.literal("mission"),
  aggregateId: z.string().min(1),
  aggregateSeq: z.number().int().positive(),
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  occurredAt: isoString,
  payload: JsonValueSchema,
}).strict();
export type MissionEventEnvelope = z.infer<typeof MissionEventEnvelopeSchema>;

export const DEFAULT_RUNTIME_CONSTRAINT_SET: RuntimeConstraintSet = {
  allowAutoExecute: false,
  requireHITL: true,
  allowExternalNetwork: false,
  allowSideEffectCommit: false,
  maxDelegationDepth: 1,
  maxParallelNodeRuns: 1,
  requireBudgetReservation: true,
  requireEvidenceRefs: true,
  allowModelCall: true,
  allowToolCall: true,
  allowFileWrite: false,
  allowDestructiveAction: false,
  requireDomainOwnerApproval: true,
  deniedToolNames: [],
  deniedDomains: [],
  dataResidency: ["default"],
  modelTrainingOptOut: true,
};

export function computeMissionSnapshotHash(snapshot: Omit<MissionContextSnapshot, "payloadHash">): string {
  return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

export function buildMissionEtag(missionId: string, version: number): string {
  return `"mission:${missionId}:${version}"`;
}

export function nextMissionStatus(current: MissionStatus, target: MissionStatus): boolean {
  const allowed: Record<MissionStatus, readonly MissionStatus[]> = {
    draft: ["active", "archived"],
    active: ["paused", "frozen", "completed"],
    paused: ["active", "frozen", "archived"],
    frozen: ["paused", "archived"],
    completed: ["archived"],
    archived: [],
  };
  return allowed[current].includes(target);
}

export function mergeRuntimeConstraintSets(
  base: RuntimeConstraintSet,
  override: Partial<RuntimeConstraintSet>,
): RuntimeConstraintSet {
  return {
    allowAutoExecute: base.allowAutoExecute && (override.allowAutoExecute ?? base.allowAutoExecute),
    requireHITL: base.requireHITL || (override.requireHITL ?? false),
    allowExternalNetwork: base.allowExternalNetwork && (override.allowExternalNetwork ?? base.allowExternalNetwork),
    allowSideEffectCommit: base.allowSideEffectCommit && (override.allowSideEffectCommit ?? base.allowSideEffectCommit),
    maxDelegationDepth: Math.min(base.maxDelegationDepth, override.maxDelegationDepth ?? base.maxDelegationDepth),
    maxParallelNodeRuns: Math.min(base.maxParallelNodeRuns, override.maxParallelNodeRuns ?? base.maxParallelNodeRuns),
    requireBudgetReservation: base.requireBudgetReservation || (override.requireBudgetReservation ?? false),
    requireEvidenceRefs: base.requireEvidenceRefs || (override.requireEvidenceRefs ?? false),
    allowModelCall: base.allowModelCall && (override.allowModelCall ?? base.allowModelCall),
    allowToolCall: base.allowToolCall && (override.allowToolCall ?? base.allowToolCall),
    allowFileWrite: base.allowFileWrite && (override.allowFileWrite ?? base.allowFileWrite),
    allowDestructiveAction: base.allowDestructiveAction && (override.allowDestructiveAction ?? base.allowDestructiveAction),
    requireDomainOwnerApproval: base.requireDomainOwnerApproval || (override.requireDomainOwnerApproval ?? false),
    deniedToolNames: [...new Set([...base.deniedToolNames, ...(override.deniedToolNames ?? [])])],
    deniedDomains: [...new Set([...base.deniedDomains, ...(override.deniedDomains ?? [])])],
    dataResidency: intersectNonEmpty(base.dataResidency, override.dataResidency ?? base.dataResidency),
    modelTrainingOptOut: base.modelTrainingOptOut || (override.modelTrainingOptOut ?? false),
  };
}

function intersectNonEmpty(left: readonly string[], right: readonly string[]): string[] {
  const values = left.filter((item) => right.includes(item));
  return values.length > 0 ? values : [...left];
}

export function principalToMissionPrincipal(principal: PrincipalRef): string {
  return principal.principalId;
}

export function riskRequiresFormalMission(riskClass: RiskClass): boolean {
  return riskClass === "high" || riskClass === "critical";
}

export * from "./playbook.js";
export * from "./operating-model.js";
