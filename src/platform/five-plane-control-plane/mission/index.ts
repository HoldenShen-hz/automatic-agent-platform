import { newId, nowIso } from "../../contracts/types/ids.js";
import { AppError } from "../../contracts/errors.js";
import {
  buildMissionEtag,
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  mergeRuntimeConstraintSets,
  nextMissionStatus,
  riskRequiresFormalMission,
  type MissionBinding,
  type MissionBudgetEnvelope,
  type MissionContextSnapshot,
  type MissionHandoffRequest,
  type MissionPermission,
  type MissionRecord,
  type MissionResolutionRequest,
  type MissionResolutionResult,
  type MissionStatus,
  type RuntimeConstraintSet,
} from "../../contracts/mission/index.js";
import type { JsonValue, NodeRun, PlanGraphBundle, PrincipalRef, RiskClass } from "../../contracts/executable-contracts/index.js";
import {
  InMemoryMissionRepository,
  type CreateMissionRecordInput,
  type MissionRepository,
} from "../../five-plane-state-evidence/truth/mission-repository.js";

export interface MissionFeatureFlags {
  readonly enabled: boolean;
  readonly requireForAllDispatch: boolean;
  readonly allowLegacyReadProjection: boolean;
  readonly rejectLegacyWritePath: boolean;
  readonly createAdHocForLegacyTask: boolean;
}

export const DEFAULT_MISSION_FEATURE_FLAGS: MissionFeatureFlags = {
  enabled: true,
  requireForAllDispatch: false,
  allowLegacyReadProjection: true,
  rejectLegacyWritePath: false,
  createAdHocForLegacyTask: true,
};

export interface MissionTransitionCommand {
  readonly missionId: string;
  readonly expectedVersion: number;
  readonly ifMatch: string;
  readonly targetStatus: MissionStatus;
  readonly actorId: string;
  readonly traceId: string;
  readonly correlationId: string;
  readonly reason?: string;
}

export class MissionLifecycleService {
  public constructor(private readonly repository: MissionRepository = new InMemoryMissionRepository()) {}

  public createMission(input: CreateMissionRecordInput): MissionRecord {
    return this.repository.createMission(input);
  }

  public transition(command: MissionTransitionCommand): MissionRecord {
    const current = this.repository.getMission(command.missionId);
    if (current == null) {
      throwMissionError("mission.not_found", "Mission was not found", { missionId: command.missionId });
    }
    if (current.version !== command.expectedVersion || current.etag !== command.ifMatch) {
      throwMissionError("mission.version_conflict", "Mission version precondition failed", {
        missionId: command.missionId,
        expectedVersion: command.expectedVersion,
        actualVersion: current.version,
      });
    }
    if (!nextMissionStatus(current.status, command.targetStatus)) {
      throwMissionError("mission.state_conflict", "Mission status transition is not allowed", {
        missionId: command.missionId,
        fromStatus: current.status,
        toStatus: command.targetStatus,
      });
    }
    const timestamp = nowIso();
    const version = current.version + 1;
    const updated: MissionRecord = {
      ...current,
      status: command.targetStatus,
      freezeReason: command.targetStatus === "frozen" ? command.reason ?? "mission.freeze_requested" : current.freezeReason,
      updatedAt: timestamp,
      updatedBy: command.actorId,
      archivedAt: command.targetStatus === "archived" ? timestamp : current.archivedAt,
      archivedBy: command.targetStatus === "archived" ? command.actorId : current.archivedBy,
      version,
      etag: buildMissionEtag(current.missionId, version),
    };
    return this.repository.updateMission(updated, {
      eventType: "platform.mission.status_changed",
      missionId: updated.missionId,
      tenantId: updated.tenantId,
      traceId: command.traceId,
      correlationId: command.correlationId,
      payload: {
        fromStatus: current.status,
        toStatus: updated.status,
        reason: command.reason ?? null,
        version,
      },
    });
  }
}

export class MissionGovernanceService {
  public constructor(private readonly repository: MissionRepository) {}

  public assertPermission(missionId: string, principal: { readonly principalId: string }, permission: MissionPermission): void {
    const mission = this.repository.getMission(missionId);
    if (mission == null) {
      throwMissionError("mission.not_found", "Mission was not found", { missionId });
    }
    const membership = this.repository.listMemberships(missionId).find((item) =>
      item.principalId === principal.principalId && item.status === "active"
    );
    if (membership == null || membership.deniedPermissions.includes(permission) || !membership.permissions.includes(permission)) {
      throwMissionError("mission.access_denied", "Mission permission was denied", {
        missionId,
        principalId: principal.principalId,
        permission,
      });
    }
  }

  public previewConstraints(input: { riskClass: RiskClass; mission?: MissionRecord | null }): RuntimeConstraintSet {
    const riskConstraints: Partial<RuntimeConstraintSet> = input.riskClass === "low"
      ? {
          allowAutoExecute: true,
          requireHITL: false,
          allowExternalNetwork: true,
          allowSideEffectCommit: false,
          maxDelegationDepth: 2,
          maxParallelNodeRuns: 4,
          requireDomainOwnerApproval: false,
        }
      : {
          allowAutoExecute: false,
          requireHITL: true,
          allowExternalNetwork: true,
          allowSideEffectCommit: false,
          maxDelegationDepth: 3,
          maxParallelNodeRuns: 8,
          requireDomainOwnerApproval: true,
        };
    return mergeRuntimeConstraintSets({
      ...DEFAULT_RUNTIME_CONSTRAINT_SET,
      allowAutoExecute: true,
      allowExternalNetwork: true,
      maxDelegationDepth: 8,
      maxParallelNodeRuns: 16,
      requireDomainOwnerApproval: false,
      dataResidency: ["default", "us", "eu"],
    }, riskConstraints);
  }
}

export class MissionResolver {
  public constructor(
    private readonly repository: MissionRepository,
    private readonly governance: MissionGovernanceService = new MissionGovernanceService(repository),
  ) {}

  public resolve(request: MissionResolutionRequest): MissionResolutionResult {
    const constraints = this.governance.previewConstraints({ riskClass: request.riskClass });
    if (request.missionRef?.mode === "use_existing") {
      const mission = this.repository.getMission(request.missionRef.missionId);
      if (mission == null || mission.tenantId !== request.tenantId) {
        return this.rejected("mission.not_found", constraints);
      }
      this.governance.assertPermission(mission.missionId, request.principal, "mission:bind_task");
      return {
        resolution: "matched_existing",
        missionId: mission.missionId,
        confidence: 1,
        requiresUserChoice: false,
        candidateMissionIds: [],
        effectiveConstraintsPreview: constraints,
        reasonCode: "mission.explicit_ref",
      };
    }

    if (riskRequiresFormalMission(request.riskClass)) {
      return this.rejected("mission.formal_required_for_risk", constraints);
    }

    const candidates = this.repository.listMissions(request.tenantId)
      .filter((mission) => mission.status === "active" || mission.status === "paused" || mission.status === "draft")
      .filter((mission) => request.domainId == null || mission.domainId == null || mission.domainId === request.domainId);
    const hinted = candidates.find((mission) =>
      mission.missionId === request.missionHint
      || mission.title === request.missionHint
      || mission.objective.toLowerCase().includes((request.missionHint ?? request.goal).toLowerCase().slice(0, 24))
    );
    if (hinted != null) {
      return {
        resolution: "matched_existing",
        missionId: hinted.missionId,
        confidence: 0.85,
        requiresUserChoice: false,
        candidateMissionIds: [],
        effectiveConstraintsPreview: constraints,
        reasonCode: "mission.hint_match",
      };
    }

    if (request.createIfMissing === true || request.missionRef?.mode === "auto_resolve" && request.missionRef.allowAdHoc) {
      const mission = this.repository.createMission({
        tenantId: request.tenantId,
        orgId: request.tenantId,
        type: "ad_hoc",
        priority: request.riskClass === "low" ? "normal" : "high",
        title: `Ad hoc mission for ${request.confirmedTaskSpecId}`,
        objective: request.goal,
        successCriteria: ["task accepted", "evidence recorded"],
        ownerPrincipalId: request.principal.principalId,
        domainId: request.domainId ?? null,
        createdBy: request.principal.principalId,
        traceId: request.traceId,
        correlationId: request.correlationId,
      });
      return {
        resolution: "created_ad_hoc",
        missionId: mission.missionId,
        confidence: 0.7,
        requiresUserChoice: false,
        candidateMissionIds: [],
        effectiveConstraintsPreview: constraints,
        reasonCode: "mission.created_ad_hoc",
      };
    }

    return {
      resolution: candidates.length > 1 ? "requires_user_choice" : "rejected",
      missionId: null,
      confidence: 0,
      requiresUserChoice: candidates.length > 1,
      candidateMissionIds: candidates.map((mission) => mission.missionId),
      effectiveConstraintsPreview: constraints,
      reasonCode: candidates.length > 1 ? "mission.choice_required" : "mission.required",
    };
  }

  private rejected(reasonCode: string, constraints: RuntimeConstraintSet): MissionResolutionResult {
    return {
      resolution: "rejected",
      missionId: null,
      confidence: 0,
      requiresUserChoice: false,
      candidateMissionIds: [],
      effectiveConstraintsPreview: constraints,
      reasonCode,
    };
  }
}

export class MissionBudgetService {
  private readonly envelopes = new Map<string, MissionBudgetEnvelope>();

  public register(envelope: MissionBudgetEnvelope): void {
    this.envelopes.set(envelope.missionId, envelope);
  }

  public reserve(missionId: string, amount: number): MissionBudgetEnvelope {
    const current = this.envelopes.get(missionId);
    if (current == null) {
      throwMissionError("mission.budget_not_found", "Mission budget envelope was not found", { missionId });
    }
    if (current.reservedAmount + current.settledAmount + amount > current.hardCap) {
      throwMissionError("mission.budget_exhausted", "Mission budget hard cap would be exceeded", {
        missionId,
        amount,
        hardCap: current.hardCap,
        reservedAmount: current.reservedAmount,
        settledAmount: current.settledAmount,
      });
    }
    const updated = { ...current, reservedAmount: current.reservedAmount + amount, version: current.version + 1 };
    this.envelopes.set(missionId, updated);
    return updated;
  }

  public settle(missionId: string, amount: number): MissionBudgetEnvelope {
    const current = this.envelopes.get(missionId);
    if (current == null) {
      throwMissionError("mission.budget_not_found", "Mission budget envelope was not found", { missionId });
    }
    const updated = {
      ...current,
      reservedAmount: Math.max(0, current.reservedAmount - amount),
      settledAmount: current.settledAmount + amount,
      version: current.version + 1,
    };
    this.envelopes.set(missionId, updated);
    return updated;
  }
}

export interface MissionLiveGuardInput {
  readonly missionSnapshotId: string;
  readonly principal: PrincipalRef;
  readonly requestedPermission?: MissionPermission;
  readonly requestedToolName?: string;
  readonly requestedDomainId?: string;
  readonly budgetReservationValid?: boolean;
  readonly panicActive?: boolean;
}

export interface MissionLiveGuardDecision {
  readonly allowed: boolean;
  readonly reasonCode: string;
}

export class MissionLiveGuard {
  public constructor(private readonly repository: MissionRepository) {}

  public evaluate(input: MissionLiveGuardInput): MissionLiveGuardDecision {
    const snapshot = this.repository.getSnapshot(input.missionSnapshotId);
    if (snapshot == null) {
      return { allowed: false, reasonCode: "mission.snapshot_not_found" };
    }
    const liveMission = this.repository.getMission(snapshot.missionId);
    if (liveMission == null || liveMission.status === "frozen" || liveMission.status === "archived" || liveMission.status === "completed") {
      return { allowed: false, reasonCode: "mission.not_executable" };
    }
    const membership = this.repository.listMemberships(snapshot.missionId).find((item) =>
      item.principalId === input.principal.principalId && item.status === "active"
    );
    if (membership == null) {
      return { allowed: false, reasonCode: "mission.membership_revoked" };
    }
    const permission = input.requestedPermission ?? "mission:execute";
    if (!membership.permissions.includes(permission) || membership.deniedPermissions.includes(permission)) {
      return { allowed: false, reasonCode: "mission.permission_denied" };
    }
    if (input.requestedToolName != null && snapshot.runtimeConstraints.deniedToolNames.includes(input.requestedToolName)) {
      return { allowed: false, reasonCode: "mission.tool_denied" };
    }
    if (input.requestedDomainId != null && snapshot.runtimeConstraints.deniedDomains.includes(input.requestedDomainId)) {
      return { allowed: false, reasonCode: "mission.domain_denied" };
    }
    if (snapshot.runtimeConstraints.requireBudgetReservation && input.budgetReservationValid === false) {
      return { allowed: false, reasonCode: "mission.budget_reservation_required" };
    }
    if (input.panicActive === true) {
      return { allowed: false, reasonCode: "mission.panic_active" };
    }
    return { allowed: true, reasonCode: "mission.live_guard_allowed" };
  }
}

export class MissionRuntimeBindingService {
  public static bindPlanGraphBundle(
    bundle: PlanGraphBundle,
    snapshot: MissionContextSnapshot,
  ): PlanGraphBundle {
    return { ...bundle, missionSnapshotRef: snapshot.missionSnapshotId };
  }

  public static bindHarnessRun(input: {
    readonly harnessRun: { readonly missionBinding?: MissionBinding } & Record<string, unknown>;
    readonly snapshot: MissionContextSnapshot;
    readonly actorId: string;
  }): MissionBinding {
    if (input.harnessRun.missionBinding != null && input.harnessRun.missionBinding.missionId !== input.snapshot.missionId) {
      throwMissionError("mission.run_single_binding_violation", "Harness run is already bound to another Mission", {
        existingMissionId: input.harnessRun.missionBinding.missionId,
        requestedMissionId: input.snapshot.missionId,
      });
    }
    return {
      missionId: input.snapshot.missionId,
      missionSnapshotId: input.snapshot.missionSnapshotId,
      missionVersion: input.snapshot.missionVersion,
      boundAt: nowIso(),
      boundBy: input.actorId,
    };
  }

  public static bindNodeRun(nodeRun: NodeRun, snapshot: MissionContextSnapshot): NodeRun {
    return { ...nodeRun, missionSnapshotRef: snapshot.missionSnapshotId };
  }
}

export class MissionHandoffService {
  public request(input: Omit<MissionHandoffRequest, "handoffId" | "createdAt"> & {
    readonly handoffId?: string;
    readonly createdAt?: string;
  }): MissionHandoffRequest {
    return {
      ...input,
      handoffId: input.handoffId ?? newId("mhandoff"),
      createdAt: input.createdAt ?? nowIso(),
    };
  }
}

export class MissionOutcomeAnalyticsService {
  public summarize(input: { readonly mission: MissionRecord; readonly tasks: readonly unknown[]; readonly runs: readonly unknown[] }): {
    readonly missionId: string;
    readonly status: MissionStatus;
    readonly taskCount: number;
    readonly runCount: number;
    readonly outcome: "active" | "successful" | "incomplete";
  } {
    return {
      missionId: input.mission.missionId,
      status: input.mission.status,
      taskCount: input.tasks.length,
      runCount: input.runs.length,
      outcome: input.mission.status === "completed" ? "successful" : input.mission.status === "archived" ? "incomplete" : "active",
    };
  }
}

export class MissionObservabilityPolicy {
  public sanitizeMetricLabels(labels: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      if (key.toLowerCase() === "missionid" || key === "mission_id") {
        continue;
      }
      sanitized[key] = value;
    }
    return sanitized;
  }

  public buildTraceAttributes(input: { readonly missionId: string; readonly missionSnapshotId?: string | null }): Record<string, string> {
    return {
      "mission.id": input.missionId,
      ...(input.missionSnapshotId != null ? { "mission.snapshot_id": input.missionSnapshotId } : {}),
    };
  }
}

export class MissionLearningPromotionGate {
  public evaluate(input: {
    readonly missionId: string;
    readonly targetScope: "mission" | "domain" | "platform";
    readonly approvalRef?: string | null;
    readonly evidenceRefs: readonly string[];
  }): { readonly allowed: boolean; readonly reasonCode: string; readonly quarantineScope: string } {
    if (input.targetScope === "mission") {
      return { allowed: true, reasonCode: "mission.learning_local", quarantineScope: input.missionId };
    }
    if (input.approvalRef == null || input.evidenceRefs.length === 0) {
      return { allowed: false, reasonCode: "mission.learning_promotion_requires_approval_and_evidence", quarantineScope: input.missionId };
    }
    return { allowed: true, reasonCode: "mission.learning_promotion_approved", quarantineScope: input.targetScope };
  }
}

export class LegacyMissionBackfillService {
  public backfillTask<T extends { readonly missionRef?: unknown }>(
    task: T,
    missionRef: MissionBinding,
  ): T & { readonly missionRef: MissionBinding } {
    if (task.missionRef != null) {
      return task as T & { readonly missionRef: MissionBinding };
    }
    return { ...task, missionRef };
  }
}

export class MissionHomeRegionService {
  private readonly epochs = new Map<string, number>();

  public assignHomeRegion(input: { readonly missionId: string; readonly region: string; readonly epoch?: number }): {
    readonly missionId: string;
    readonly region: string;
    readonly epoch: number;
  } {
    const epoch = input.epoch ?? (this.epochs.get(input.missionId) ?? 0) + 1;
    this.epochs.set(input.missionId, epoch);
    return { missionId: input.missionId, region: input.region, epoch };
  }

  public assertWriteEpoch(missionId: string, epoch: number): void {
    const current = this.epochs.get(missionId);
    if (current != null && epoch < current) {
      throwMissionError("mission.region_epoch_stale", "Mission region epoch is stale", {
        missionId,
        currentEpoch: current,
        requestedEpoch: epoch,
      });
    }
  }
}

function throwMissionError(code: string, message: string, details: Record<string, unknown>): never {
  throw new AppError(code, message, {
    category: "business-rule",
    source: "policy",
    statusCode: code.endsWith("not_found") ? 404 : 409,
    retryable: code.endsWith("version_conflict") || code.endsWith("region_epoch_stale"),
    details,
  });
}

export class MissionTemplateIntegrationService {
  public createTemplateBinding(input: { readonly missionId: string; readonly templateId: string; readonly packageId?: string | null }): {
    readonly bindingId: string;
    readonly missionId: string;
    readonly templateId: string;
    readonly packageId: string | null;
  } {
    return {
      bindingId: newId("mtpl"),
      missionId: input.missionId,
      templateId: input.templateId,
      packageId: input.packageId ?? null,
    };
  }
}

export function createMissionContextSnapshot(
  repository: MissionRepository,
  input: {
    readonly missionId: string;
    readonly taskId: string;
    readonly confirmedTaskSpecId: string;
    readonly principal: PrincipalRef;
    readonly traceId: string;
    readonly correlationId: string;
    readonly runtimeConstraints?: RuntimeConstraintSet;
  },
): MissionContextSnapshot {
  const snapshotInput: Parameters<MissionRepository["createSnapshot"]>[0] = {
    missionId: input.missionId,
    taskId: input.taskId,
    confirmedTaskSpecId: input.confirmedTaskSpecId,
    traceId: input.traceId,
    correlationId: input.correlationId,
    createdBy: input.principal.principalId,
  };
  if (input.runtimeConstraints != null) {
    snapshotInput.runtimeConstraints = input.runtimeConstraints;
  }
  return repository.createSnapshot(snapshotInput);
}

export function createMissionMetadata(value: JsonValue = {}): JsonValue {
  return value;
}
