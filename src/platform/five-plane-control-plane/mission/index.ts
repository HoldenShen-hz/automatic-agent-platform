import { newId, nowIso } from "../../contracts/types/ids.js";
import { AppError } from "../../contracts/errors.js";
import {
  buildMissionEtag,
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  mergeRuntimeConstraintSets,
  nextMissionStatus,
  riskRequiresFormalMission,
  hashExitCriterionExpression,
  ExitCriterionExpressionSchema,
  MissionPlaybookMigrationPlanSchema,
  MissionPlaybookResolutionPolicySchema,
  MissionPlaybookResolutionResultSchema,
  MissionPlaybookSchema,
  MissionStageInstanceSchema,
  StageExitDecisionSchema,
  StageExitSnapshotSchema,
  type ExitCriterion,
  type ExitCriterionEvaluationResult,
  type ExitCriterionExpression,
  type MissionBinding,
  type MissionBudgetEnvelope,
  type MissionContextSnapshot,
  type MissionHandoffRequest,
  type MissionPlaybook,
  type MissionPlaybookMigrationPlan,
  type MissionPlaybookResolutionPolicy,
  type MissionPlaybookResolutionResult,
  type MissionPlaybookStage,
  type MissionPermission,
  type MissionRecord,
  type MissionResolutionRequest,
  type MissionResolutionResult,
  type MissionStageInstance,
  type StageExitDecision,
  type StageExitSnapshot,
  type MissionStatus,
  type RuntimeConstraintSet,
} from "../../contracts/mission/index.js";
import type { JsonValue, NodeRun, PlanGraphBundle, PrincipalRef, RiskClass } from "../../contracts/executable-contracts/index.js";
import {
  InMemoryMissionRepository,
  type CreateMissionRecordInput,
  type MissionRepository,
} from "../../five-plane-state-evidence/truth/mission-repository.js";

export * from "./operating-model.js";

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
      .filter((mission) => mission.status === "active" || mission.status === "paused")
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

    const shouldCreateAdHoc = request.createIfMissing === true
      || (request.missionRef?.mode === "auto_resolve" && request.missionRef.allowAdHoc === true);
    if (shouldCreateAdHoc) {
      const mission = this.repository.createMission({
        tenantId: request.tenantId,
        orgId: null,
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
  private readonly trustedTenantPairs = new Set<string>();

  public trustTenantPair(sourceTenantId: string, targetTenantId: string): void {
    this.trustedTenantPairs.add(`${sourceTenantId}:${targetTenantId}`);
  }

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

  public requestFederated(input: {
    readonly sourceMission: MissionRecord;
    readonly targetMission: MissionRecord;
    readonly requestedBy: string;
    readonly approvalRef: string;
    readonly auditRef: string;
    readonly reason: string;
    readonly budgetTransferRef?: string | null;
  }): MissionHandoffRequest {
    if (
      input.sourceMission.tenantId !== input.targetMission.tenantId
      && !this.trustedTenantPairs.has(`${input.sourceMission.tenantId}:${input.targetMission.tenantId}`)
    ) {
      throwMissionError("mission.handoff_trust_missing", "Cross-tenant Mission handoff requires an accepted trust pair", {
        sourceTenantId: input.sourceMission.tenantId,
        targetTenantId: input.targetMission.tenantId,
      });
    }
    return this.request({
      sourceMissionId: input.sourceMission.missionId,
      targetMissionId: input.targetMission.missionId,
      tenantId: input.sourceMission.tenantId,
      requestedBy: input.requestedBy,
      approvalRef: input.approvalRef,
      budgetTransferRef: input.budgetTransferRef ?? null,
      auditRef: input.auditRef,
      reason: input.reason,
    });
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

export interface MissionPlaybookValidationCatalog {
  readonly metricRefs?: readonly string[];
  readonly eventNames?: readonly string[];
  readonly evidenceKinds?: readonly string[];
  readonly maxExpressionDepth?: number;
  readonly requireFailureModeRefs?: boolean;
}

export type MissionPlaybookLifecycleEventType =
  | "mission.playbook.registered"
  | "mission.playbook.validated"
  | "mission.playbook.validation_failed"
  | "mission.playbook.rejected"
  | "mission.playbook.canary.started"
  | "mission.playbook.activated"
  | "mission.playbook.updated"
  | "mission.playbook.deprecated"
  | "mission.playbook.suspended"
  | "mission.playbook.revoked"
  | "mission.playbook.archived";

export interface MissionPlaybookLifecycleEvent {
  readonly eventId: string;
  readonly eventType: MissionPlaybookLifecycleEventType;
  readonly playbookId: string;
  readonly version: string;
  readonly missionType: MissionPlaybook["missionType"];
  readonly auditRef: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
}

export interface MissionPlaybookStatusTransitionCommand {
  readonly playbookId: string;
  readonly version: string;
  readonly targetStatus: MissionPlaybook["status"];
  readonly actorId: string;
  readonly auditRef: string;
  readonly reasonCode?: string;
  readonly replacementVersion?: string;
  readonly affectedMissionRefs?: readonly string[];
  readonly occurredAt?: string;
}

export interface MissionPlaybookTenantOverride {
  readonly tenantId: string;
  readonly missionType: MissionPlaybook["missionType"];
  readonly playbookId: string;
  readonly version: string;
}

export interface MissionPlaybookValidationIssue {
  readonly code:
    | "mission.playbook.duplicate_stage"
    | "mission.playbook.entry_stage_missing"
    | "mission.playbook.edge_stage_missing"
    | "mission.playbook.exit_criteria_missing"
    | "mission.playbook.failure_mode_missing"
    | "mission.playbook.unknown_metric"
    | "mission.playbook.unknown_event"
    | "mission.playbook.unknown_evidence_kind"
    | "mission.playbook.expression_depth_exceeded"
    | "mission.playbook.p0_unsafe_negation"
    | "mission.playbook.compatibility_missing"
    | "mission.playbook.signature_missing"
    | "mission.playbook.rollback_missing"
    | "mission.playbook.canary_rollout_missing";
  readonly path: string;
  readonly message: string;
}

export interface MissionPlaybookValidationResult {
  readonly valid: boolean;
  readonly issues: readonly MissionPlaybookValidationIssue[];
}

export class MissionPlaybookRegistry {
  private static readonly MAX_LIFECYCLE_EVENTS = 500;
  private readonly playbooks = new Map<string, MissionPlaybook>();
  private readonly activeByMissionType = new Map<MissionPlaybook["missionType"], string>();
  private readonly lastActiveByMissionType = new Map<MissionPlaybook["missionType"], string>();
  private readonly tenantOverrides = new Map<string, string>();
  private readonly lifecycleEvents: MissionPlaybookLifecycleEvent[] = [];

  public constructor(private readonly catalog: MissionPlaybookValidationCatalog = {}) {}

  public register(input: MissionPlaybook): MissionPlaybook {
    const playbook = MissionPlaybookSchema.parse(input);
    const validation = validateMissionPlaybook(playbook, this.catalog);
    if (!validation.valid) {
      throwMissionError("mission.playbook_invalid", "Mission playbook failed validation", {
        playbookId: playbook.playbookId,
        version: playbook.version,
        issues: validation.issues,
      });
    }
    const key = playbookKey(playbook.playbookId, playbook.version);
    this.playbooks.set(key, playbook);
    if (playbook.status === "active") {
      this.activeByMissionType.set(playbook.missionType, key);
      this.lastActiveByMissionType.set(playbook.missionType, key);
    }
    this.appendLifecycleEvent({
      eventType: "mission.playbook.registered",
      playbook,
      auditRef: `audit:mission_playbook:${playbook.playbookId}:${playbook.version}:registered`,
      payload: {
        owner: playbook.owner,
        status: playbook.status,
      },
      occurredAt: playbook.updatedAt,
    });
    return playbook;
  }

  public get(playbookId: string, version: string): MissionPlaybook | null {
    return this.playbooks.get(playbookKey(playbookId, version)) ?? null;
  }

  public transitionStatus(command: MissionPlaybookStatusTransitionCommand): MissionPlaybook {
    const current = this.get(command.playbookId, command.version);
    if (current == null) {
      throwMissionError("mission.playbook_not_found", "Mission playbook was not found", {
        playbookId: command.playbookId,
        version: command.version,
      });
    }
    if (!isMissionPlaybookStatusTransitionAllowed(current.status, command.targetStatus)) {
      throwMissionError("mission.playbook_state_conflict", "Mission playbook status transition is not allowed", {
        playbookId: current.playbookId,
        version: current.version,
        fromStatus: current.status,
        toStatus: command.targetStatus,
      });
    }
    const updated = MissionPlaybookSchema.parse({
      ...current,
      status: command.targetStatus,
      updatedAt: command.occurredAt ?? nowIso(),
    });
    this.playbooks.set(playbookKey(updated.playbookId, updated.version), updated);
    if (updated.status === "active") {
      this.activeByMissionType.set(updated.missionType, playbookKey(updated.playbookId, updated.version));
      this.lastActiveByMissionType.set(updated.missionType, playbookKey(updated.playbookId, updated.version));
    } else if (this.activeByMissionType.get(updated.missionType) === playbookKey(updated.playbookId, updated.version)) {
      this.activeByMissionType.delete(updated.missionType);
    }
    this.appendLifecycleEvent({
      eventType: lifecycleEventTypeForStatus(updated.status),
      playbook: updated,
      auditRef: command.auditRef,
      payload: {
        actorId: command.actorId,
        reasonCode: command.reasonCode ?? null,
        replacementVersion: command.replacementVersion ?? null,
        affectedMissionRefs: [...(command.affectedMissionRefs ?? [])],
      },
      occurredAt: updated.updatedAt,
    });
    return updated;
  }

  public setTenantOverride(input: MissionPlaybookTenantOverride): void {
    const playbook = this.get(input.playbookId, input.version);
    if (playbook == null || playbook.missionType !== input.missionType) {
      throwMissionError("mission.playbook_not_found", "Mission playbook tenant override requires a registered playbook", { ...input });
    }
    this.tenantOverrides.set(tenantOverrideKey(input.tenantId, input.missionType), playbookKey(input.playbookId, input.version));
  }

  public resolveTenantOverride(tenantId: string, missionType: MissionPlaybook["missionType"]): MissionPlaybook | null {
    const key = this.tenantOverrides.get(tenantOverrideKey(tenantId, missionType));
    return key == null ? null : this.playbooks.get(key) ?? null;
  }

  public resolveActive(missionType: MissionPlaybook["missionType"]): MissionPlaybook | null {
    const key = this.activeByMissionType.get(missionType);
    return key == null ? null : this.playbooks.get(key) ?? null;
  }

  public resolveLastActive(missionType: MissionPlaybook["missionType"]): MissionPlaybook | null {
    const key = this.lastActiveByMissionType.get(missionType);
    return key == null ? null : this.playbooks.get(key) ?? null;
  }

  public resolveCanary(missionType: MissionPlaybook["missionType"], tenantId: string): MissionPlaybook | null {
    const candidates = this.listByMissionType(missionType).filter((playbook) => playbook.status === "canary");
    return candidates.find((playbook) => isTenantTargetedByRollout(playbook, tenantId)) ?? null;
  }

  public listByMissionType(missionType: MissionPlaybook["missionType"]): readonly MissionPlaybook[] {
    return this.list().filter((playbook) => playbook.missionType === missionType);
  }

  public listEvents(): readonly MissionPlaybookLifecycleEvent[] {
    return [...this.lifecycleEvents];
  }

  public list(): readonly MissionPlaybook[] {
    return [...this.playbooks.values()];
  }

  private appendLifecycleEvent(input: {
    readonly eventType: MissionPlaybookLifecycleEventType;
    readonly playbook: MissionPlaybook;
    readonly auditRef: string;
    readonly payload: Record<string, unknown>;
    readonly occurredAt: string;
  }): void {
    this.lifecycleEvents.push({
      eventId: newId("mpbevt"),
      eventType: input.eventType,
      playbookId: input.playbook.playbookId,
      version: input.playbook.version,
      missionType: input.playbook.missionType,
      auditRef: input.auditRef,
      payload: input.payload,
      occurredAt: input.occurredAt,
    });
    if (this.lifecycleEvents.length > MissionPlaybookRegistry.MAX_LIFECYCLE_EVENTS) {
      this.lifecycleEvents.splice(0, this.lifecycleEvents.length - MissionPlaybookRegistry.MAX_LIFECYCLE_EVENTS);
    }
  }
}

export interface MissionPlaybookResolverMetrics {
  readonly useLastActiveCount: number;
  readonly unsafeFallbackBlockedCount: number;
}

export class MissionPlaybookResolver {
  private metrics: MissionPlaybookResolverMetrics = {
    useLastActiveCount: 0,
    unsafeFallbackBlockedCount: 0,
  };

  public constructor(
    private readonly registry: MissionPlaybookRegistry,
    private readonly options: {
      readonly platformVersion?: string;
      readonly missionSchemaVersion?: string;
    } = {},
  ) {}

  public resolve(input: MissionPlaybookResolutionPolicy): MissionPlaybookResolutionResult {
    const policy = MissionPlaybookResolutionPolicySchema.parse(input);
    const platformVersion = this.options.platformVersion ?? "2.0.0";
    const missionSchemaVersion = this.options.missionSchemaVersion ?? "1.0.0";
    const explicit = this.resolveExplicit(policy, platformVersion, missionSchemaVersion);
    if (explicit != null) {
      return explicit;
    }
    if (policy.tenantOverrideAllowed) {
      const overridden = this.registry.resolveTenantOverride(policy.tenantId, policy.missionType);
      if (overridden != null && isPlaybookResolvable(overridden, platformVersion, missionSchemaVersion, policy.tenantId, policy.allowCanary)) {
        return MissionPlaybookResolutionResultSchema.parse({
          playbookId: overridden.playbookId,
          playbookVersion: overridden.version,
          resolutionReason: "tenant_override",
          auditRef: resolutionAuditRef(policy, overridden, "tenant_override"),
          ...(overridden.rollout == null ? {} : { rolloutRef: overridden.rollout.rolloutRef }),
        });
      }
    }
    if (policy.allowCanary) {
      const canary = this.registry.resolveCanary(policy.missionType, policy.tenantId);
      if (canary != null && isPlaybookResolvable(canary, platformVersion, missionSchemaVersion, policy.tenantId, true)) {
        return MissionPlaybookResolutionResultSchema.parse({
          playbookId: canary.playbookId,
          playbookVersion: canary.version,
          resolutionReason: "canary_rollout",
          rolloutRef: canary.rollout?.rolloutRef,
          auditRef: resolutionAuditRef(policy, canary, "canary_rollout"),
        });
      }
    }
    const active = this.registry.resolveActive(policy.missionType);
    if (active != null && isPlaybookResolvable(active, platformVersion, missionSchemaVersion, policy.tenantId, policy.allowCanary)) {
      return MissionPlaybookResolutionResultSchema.parse({
        playbookId: active.playbookId,
        playbookVersion: active.version,
        resolutionReason: "default_active",
        auditRef: resolutionAuditRef(policy, active, "default_active"),
      });
    }
    if (policy.fallbackPolicy === "use_last_active") {
      const lastActive = this.registry.resolveLastActive(policy.missionType);
      if (lastActive != null && isPlaybookFallbackSafe(lastActive, platformVersion, missionSchemaVersion, policy.tenantId)) {
        this.metrics = {
          ...this.metrics,
          useLastActiveCount: this.metrics.useLastActiveCount + 1,
        };
        return MissionPlaybookResolutionResultSchema.parse({
          playbookId: lastActive.playbookId,
          playbookVersion: lastActive.version,
          resolutionReason: "last_active_fallback",
          auditRef: resolutionAuditRef(policy, lastActive, "last_active_fallback"),
        });
      }
      this.metrics = {
        ...this.metrics,
        unsafeFallbackBlockedCount: this.metrics.unsafeFallbackBlockedCount + 1,
      };
    }
    if (policy.fallbackPolicy === "manual_selection") {
      throwMissionError("mission.playbook_manual_selection_required", "Mission playbook resolution requires manual selection", {
        missionType: policy.missionType,
        tenantId: policy.tenantId,
      });
    }
    throwMissionError("mission.playbook_resolution_failed", "Mission playbook resolution failed closed", {
      missionType: policy.missionType,
      tenantId: policy.tenantId,
      fallbackPolicy: policy.fallbackPolicy,
    });
  }

  public metricsSnapshot(): MissionPlaybookResolverMetrics {
    return { ...this.metrics };
  }

  private resolveExplicit(
    policy: MissionPlaybookResolutionPolicy,
    platformVersion: string,
    missionSchemaVersion: string,
  ): MissionPlaybookResolutionResult | null {
    if (policy.requestedPlaybookId == null) {
      return null;
    }
    const playbook = policy.requestedVersion == null
      ? this.registry.listByMissionType(policy.missionType).find((candidate) =>
          candidate.playbookId === policy.requestedPlaybookId
          && isPlaybookResolvable(candidate, platformVersion, missionSchemaVersion, policy.tenantId, policy.allowCanary)
        ) ?? null
      : this.registry.get(policy.requestedPlaybookId, policy.requestedVersion);
    if (playbook == null || !isPlaybookResolvable(playbook, platformVersion, missionSchemaVersion, policy.tenantId, policy.allowCanary)) {
      throwMissionError("mission.playbook_resolution_failed", "Explicit Mission playbook request is not resolvable", {
        missionType: policy.missionType,
        tenantId: policy.tenantId,
        requestedPlaybookId: policy.requestedPlaybookId,
        requestedVersion: policy.requestedVersion ?? null,
      });
    }
    return MissionPlaybookResolutionResultSchema.parse({
      playbookId: playbook.playbookId,
      playbookVersion: playbook.version,
      resolutionReason: "explicit_request",
      auditRef: resolutionAuditRef(policy, playbook, "explicit_request"),
      ...(playbook.rollout == null ? {} : { rolloutRef: playbook.rollout.rolloutRef }),
    });
  }
}

export class MissionPlaybookMigrationService {
  private readonly plans = new Map<string, MissionPlaybookMigrationPlan>();

  public constructor(
    private readonly registry: MissionPlaybookRegistry,
    private readonly repository?: MissionRepository,
  ) {}

  public createPlan(input: Omit<MissionPlaybookMigrationPlan, "migrationPlanId" | "createdAt" | "affectedMissionIds"> & {
    readonly migrationPlanId?: string;
    readonly createdAt?: string;
    readonly affectedMissionIds?: readonly string[];
    readonly tenantId?: string;
    readonly compatible?: boolean;
  }): MissionPlaybookMigrationPlan {
    const fromPlaybook = this.registry.get(input.fromPlaybookId, input.fromVersion);
    const toPlaybook = this.registry.get(input.toPlaybookId, input.toVersion);
    if (fromPlaybook == null || toPlaybook == null) {
      throwMissionError("mission.playbook_not_found", "Mission playbook migration requires registered source and target playbooks", {
        fromPlaybookId: input.fromPlaybookId,
        fromVersion: input.fromVersion,
        toPlaybookId: input.toPlaybookId,
        toVersion: input.toVersion,
      });
    }
    if ((input.compatible === false || input.migrationMode !== "auto_if_compatible") && input.approvalRef == null) {
      throwMissionError("mission.playbook_migration_approval_required", "Mission playbook migration requires HITL approval", {
        fromPlaybookId: input.fromPlaybookId,
        toPlaybookId: input.toPlaybookId,
        migrationMode: input.migrationMode,
      });
    }
    const affectedMissionIds = input.affectedMissionIds == null
      ? resolveAffectedMissionIds(this.repository, input.tenantId, input.fromPlaybookId, input.fromVersion)
      : [...input.affectedMissionIds];
    const {
      tenantId: _tenantId,
      compatible: _compatible,
      affectedMissionIds: _ignoredAffectedMissionIds,
      migrationPlanId,
      createdAt,
      ...schemaInput
    } = input;
    const plan = MissionPlaybookMigrationPlanSchema.parse({
      ...schemaInput,
      migrationPlanId: migrationPlanId ?? newId("mpbmig"),
      affectedMissionIds,
      createdAt: createdAt ?? nowIso(),
    });
    this.plans.set(plan.migrationPlanId, plan);
    return plan;
  }

  public listPlans(): readonly MissionPlaybookMigrationPlan[] {
    return [...this.plans.values()];
  }
}

export interface StageExitGateInput {
  readonly mission: MissionRecord;
  readonly stageInstance: MissionStageInstance;
  readonly playbookId: string;
  readonly playbookVersion: string;
  readonly snapshot: StageExitSnapshot;
  readonly targetStageId?: string;
  readonly actorId: string;
  readonly traceId: string;
  readonly correlationId: string;
  readonly evaluatedAt?: string;
}

export class StageExitGateService {
  public constructor(
    private readonly playbooks: MissionPlaybookRegistry,
    private readonly repository?: MissionRepository,
  ) {}

  public evaluate(input: StageExitGateInput): StageExitDecision {
    const stageInstance = MissionStageInstanceSchema.parse(input.stageInstance);
    const snapshot = StageExitSnapshotSchema.parse(input.snapshot);
    const playbook = this.playbooks.get(input.playbookId, input.playbookVersion);
    if (playbook == null) {
      throwMissionError("mission.playbook_not_found", "Mission stage exit requires a registered playbook", {
        playbookId: input.playbookId,
        version: input.playbookVersion,
      });
    }
    if (
      stageInstance.missionId !== input.mission.missionId
      || stageInstance.playbookId !== playbook.playbookId
      || stageInstance.playbookVersion !== playbook.version
    ) {
      throwMissionError("mission.stage_binding_mismatch", "Mission stage does not match the stage exit playbook binding", {
        missionId: input.mission.missionId,
        stageInstanceId: stageInstance.stageInstanceId,
        stagePlaybookId: stageInstance.playbookId,
        requestedPlaybookId: playbook.playbookId,
      });
    }
    if (stageInstance.status !== "active" && stageInstance.status !== "exit_evaluating") {
      throwMissionError("mission.stage_not_exit_evaluable", "Mission stage is not eligible for exit evaluation", {
        stageInstanceId: stageInstance.stageInstanceId,
        stageStatus: stageInstance.status,
      });
    }
    const stage = findPlaybookStage(playbook, stageInstance.stageId);
    if (stage == null) {
      throwMissionError("mission.stage_not_found", "Mission stage was not found in the bound playbook", {
        stageId: stageInstance.stageId,
        playbookId: playbook.playbookId,
      });
    }
    const criterionResults = stage.exitCriteria.map((criterion) => evaluateExitCriterion(criterion, snapshot));
    const failedCriterionIds = criterionResults.filter((result) => !result.passed).map((result) => result.criterionId);
    const edge = resolveStageEdge(playbook, stage.stageId, input.targetStageId);
    if (input.targetStageId != null && edge == null) {
      throwMissionError("mission.stage_edge_not_found", "Requested Mission stage edge does not exist", {
        fromStageId: stage.stageId,
        targetStageId: input.targetStageId,
      });
    }
    const hitlRequired = edge?.requiresHitl === true && snapshot.hitlDecisions[`stage_edge:${edge.edgeId}`] !== "approved";
    const decision = StageExitDecisionSchema.parse({
      decisionId: newId("mstage_decision"),
      missionId: input.mission.missionId,
      stageInstanceId: stageInstance.stageInstanceId,
      stageId: stage.stageId,
      playbookId: playbook.playbookId,
      playbookVersion: playbook.version,
      decision: failedCriterionIds.length > 0 ? "hold" : hitlRequired ? "require_hitl" : "advance",
      targetStageId: edge?.toStageId ?? null,
      criterionResults,
      failedCriterionIds,
      requiredActions: failedCriterionIds.length > 0
        ? failedCriterionIds.map((criterionId) => `satisfy_exit_criterion:${criterionId}`)
        : hitlRequired && edge != null ? [`approve_stage_edge:${edge.edgeId}`] : [],
      evaluatedAt: input.evaluatedAt ?? nowIso(),
    });
    this.appendEvaluationEvent(input, decision);
    return decision;
  }

  private appendEvaluationEvent(input: StageExitGateInput, decision: StageExitDecision): void {
    if (this.repository == null) {
      return;
    }
    this.repository.appendEvent({
      eventType: "platform.mission.stage_exit_evaluated",
      missionId: input.mission.missionId,
      tenantId: input.mission.tenantId,
      traceId: input.traceId,
      correlationId: input.correlationId,
      payload: {
        decisionId: decision.decisionId,
        stageInstanceId: decision.stageInstanceId,
        stageId: decision.stageId,
        playbookId: decision.playbookId,
        playbookVersion: decision.playbookVersion,
        decision: decision.decision,
        targetStageId: decision.targetStageId,
        failedCriterionIds: decision.failedCriterionIds,
        criterionResultRefs: decision.criterionResults.map((result) => ({
          criterionId: result.criterionId,
          expressionHash: result.expressionHash,
          passed: result.passed,
        })),
      },
      occurredAt: decision.evaluatedAt,
    });
  }
}

export function validateMissionPlaybook(
  input: MissionPlaybook,
  catalog: MissionPlaybookValidationCatalog = {},
): MissionPlaybookValidationResult {
  const playbook = MissionPlaybookSchema.parse(input);
  const issues: MissionPlaybookValidationIssue[] = [];
  if ((playbook.status === "active" || playbook.status === "canary") && (playbook.compatibility == null || playbook.compatibilityRef == null)) {
    issues.push({
      code: "mission.playbook.compatibility_missing",
      path: "compatibility",
      message: `Playbook ${playbook.playbookId}@${playbook.version} must declare compatibility metadata before rollout`,
    });
  }
  if ((playbook.status === "active" || playbook.status === "canary") && (playbook.signature == null || playbook.signatureRef == null)) {
    issues.push({
      code: "mission.playbook.signature_missing",
      path: "signature",
      message: `Playbook ${playbook.playbookId}@${playbook.version} must declare signature metadata before rollout`,
    });
  }
  if ((playbook.status === "active" || playbook.status === "canary") && (playbook.rollback == null || playbook.rollbackRef == null)) {
    issues.push({
      code: "mission.playbook.rollback_missing",
      path: "rollback",
      message: `Playbook ${playbook.playbookId}@${playbook.version} must declare rollback metadata before rollout`,
    });
  }
  if (playbook.status === "canary" && (playbook.rollout == null || playbook.rollout.mode !== "canary")) {
    issues.push({
      code: "mission.playbook.canary_rollout_missing",
      path: "rollout",
      message: `Canary playbook ${playbook.playbookId}@${playbook.version} requires canary rollout metadata`,
    });
  }
  const stageIds = new Set<string>();
  for (const [index, stage] of playbook.stages.entries()) {
    if (stageIds.has(stage.stageId)) {
      issues.push({
        code: "mission.playbook.duplicate_stage",
        path: `stages[${index}].stageId`,
        message: `Duplicate stage id ${stage.stageId}`,
      });
    }
    stageIds.add(stage.stageId);
    if (stage.exitCriteria.length === 0) {
      issues.push({
        code: "mission.playbook.exit_criteria_missing",
        path: `stages[${index}].exitCriteria`,
        message: `Stage ${stage.stageId} must declare exit criteria`,
      });
    }
    if (catalog.requireFailureModeRefs !== false && stage.failureModeRefs.length === 0) {
      issues.push({
        code: "mission.playbook.failure_mode_missing",
        path: `stages[${index}].failureModeRefs`,
        message: `Stage ${stage.stageId} must declare a failure mode reference`,
      });
    }
    for (const [criterionIndex, criterion] of stage.exitCriteria.entries()) {
      validateExitExpression(criterion.expression, {
        catalog,
        criterion,
        path: `stages[${index}].exitCriteria[${criterionIndex}].expression`,
        issues,
        depth: 1,
      });
    }
  }
  if (!stageIds.has(playbook.entryStageId)) {
    issues.push({
      code: "mission.playbook.entry_stage_missing",
      path: "entryStageId",
      message: `Entry stage ${playbook.entryStageId} does not exist`,
    });
  }
  for (const [index, edge] of playbook.edges.entries()) {
    if (!stageIds.has(edge.fromStageId) || !stageIds.has(edge.toStageId)) {
      issues.push({
        code: "mission.playbook.edge_stage_missing",
        path: `edges[${index}]`,
        message: `Edge ${edge.edgeId} must reference existing stages`,
      });
    }
  }
  return { valid: issues.length === 0, issues };
}

function validateExitExpression(input: ExitCriterionExpression, state: {
  readonly catalog: MissionPlaybookValidationCatalog;
  readonly criterion: ExitCriterion;
  readonly path: string;
  readonly issues: MissionPlaybookValidationIssue[];
  readonly depth: number;
}): void {
  const expression = ExitCriterionExpressionSchema.parse(input);
  if (state.depth > (state.catalog.maxExpressionDepth ?? 8)) {
    state.issues.push({
      code: "mission.playbook.expression_depth_exceeded",
      path: state.path,
      message: `Exit criterion ${state.criterion.criterionId} exceeds the expression depth limit`,
    });
    return;
  }
  if (expression.type === "metric_threshold" && state.catalog.metricRefs != null && !state.catalog.metricRefs.includes(expression.metric)) {
    state.issues.push({
      code: "mission.playbook.unknown_metric",
      path: `${state.path}.metric`,
      message: `Metric ${expression.metric} is not registered for stage exit evaluation`,
    });
  }
  if (expression.type === "event_count" && state.catalog.eventNames != null && !state.catalog.eventNames.includes(expression.eventName)) {
    state.issues.push({
      code: "mission.playbook.unknown_event",
      path: `${state.path}.eventName`,
      message: `Event ${expression.eventName} is not registered for stage exit evaluation`,
    });
  }
  if (expression.type === "evidence_exists" && state.catalog.evidenceKinds != null && !state.catalog.evidenceKinds.includes(expression.evidenceKind)) {
    state.issues.push({
      code: "mission.playbook.unknown_evidence_kind",
      path: `${state.path}.evidenceKind`,
      message: `Evidence kind ${expression.evidenceKind} is not registered for stage exit evaluation`,
    });
  }
  if (expression.type === "not" && state.criterion.severity === "P0") {
    state.issues.push({
      code: "mission.playbook.p0_unsafe_negation",
      path: state.path,
      message: `P0 exit criterion ${state.criterion.criterionId} must not use a top-level negation`,
    });
  }
  if (expression.type === "not") {
    validateExitExpression(expression.criterion, { ...state, path: `${state.path}.criterion`, depth: state.depth + 1 });
  }
  if (expression.type === "all_of" || expression.type === "any_of") {
    for (const [index, criterion] of expression.criteria.entries()) {
      validateExitExpression(criterion, { ...state, path: `${state.path}.criteria[${index}]`, depth: state.depth + 1 });
    }
  }
}

function evaluateExitCriterion(criterion: ExitCriterion, snapshot: StageExitSnapshot): ExitCriterionEvaluationResult {
  const result = evaluateExitExpression(criterion.expression, snapshot);
  return {
    criterionId: criterion.criterionId,
    expressionHash: hashExitCriterionExpression(criterion.expression),
    passed: result.passed,
    actualValue: result.actualValue,
    expectedValue: result.expectedValue,
    snapshotRefs: snapshot.snapshotRefs,
    evidenceRefs: criterion.requiredEvidenceRefs,
    ...(result.reasonCode != null ? { reasonCode: result.reasonCode } : {}),
  };
}

function evaluateExitExpression(expression: ExitCriterionExpression, snapshot: StageExitSnapshot): {
  readonly passed: boolean;
  readonly actualValue: number | string | boolean | null;
  readonly expectedValue: number | string | boolean | null;
  readonly reasonCode?: string;
} {
  if (expression.type === "metric_threshold") {
    const actual = snapshot.metricValues[expression.metric];
    return actual == null
      ? { passed: false, actualValue: null, expectedValue: expression.value, reasonCode: "mission.stage.metric_missing" }
      : { passed: compareValues(actual, expression.operator, expression.value), actualValue: actual, expectedValue: expression.value };
  }
  if (expression.type === "event_count") {
    const actual = snapshot.eventCounts[expression.eventName] ?? 0;
    return { passed: compareValues(actual, expression.operator, expression.value), actualValue: actual, expectedValue: expression.value };
  }
  if (expression.type === "evidence_exists") {
    const actual = snapshot.evidenceCounts[expression.evidenceKind] ?? 0;
    const expected = expression.minCount ?? 1;
    return { passed: actual >= expected, actualValue: actual, expectedValue: expected };
  }
  if (expression.type === "hitl_decision") {
    const actual = snapshot.hitlDecisions[expression.decisionType] ?? null;
    return {
      passed: actual === expression.requiredDecision,
      actualValue: actual,
      expectedValue: expression.requiredDecision,
      ...(actual == null ? { reasonCode: "mission.stage.hitl_missing" } : {}),
    };
  }
  if (expression.type === "all_of" || expression.type === "any_of") {
    const nested = expression.criteria.map((criterion) => evaluateExitExpression(criterion, snapshot));
    const passed = expression.type === "all_of" ? nested.every((result) => result.passed) : nested.some((result) => result.passed);
    return {
      passed,
      actualValue: passed,
      expectedValue: true,
      ...(passed ? {} : { reasonCode: `mission.stage.${expression.type}_failed` }),
    };
  }
  if (expression.type === "not") {
    const nested = evaluateExitExpression(expression.criterion, snapshot);
    return { passed: !nested.passed, actualValue: !nested.passed, expectedValue: true };
  }
  return { passed: false, actualValue: null, expectedValue: true, reasonCode: "mission.stage.expression_unknown" };
}

function compareValues(
  actual: number | string | boolean,
  operator: "==" | "!=" | ">=" | ">" | "<=" | "<",
  expected: number | string | boolean,
): boolean {
  if (operator === "==") {
    return actual === expected;
  }
  if (operator === "!=") {
    return actual !== expected;
  }
  if (typeof actual !== typeof expected || typeof actual === "boolean" || typeof expected === "boolean") {
    return false;
  }
  switch (operator) {
    case ">=":
      return actual >= expected;
    case ">":
      return actual > expected;
    case "<=":
      return actual <= expected;
    case "<":
      return actual < expected;
  }
  return false;
}

function findPlaybookStage(playbook: MissionPlaybook, stageId: string): MissionPlaybookStage | null {
  return playbook.stages.find((stage) => stage.stageId === stageId) ?? null;
}

function resolveStageEdge(playbook: MissionPlaybook, stageId: string, targetStageId?: string) {
  return playbook.edges.find((edge) =>
    edge.fromStageId === stageId && (targetStageId == null || edge.toStageId === targetStageId)
  ) ?? null;
}

function playbookKey(playbookId: string, version: string): string {
  return `${playbookId}@${version}`;
}

function tenantOverrideKey(tenantId: string, missionType: MissionPlaybook["missionType"]): string {
  return `${tenantId}:${missionType}`;
}

function isMissionPlaybookStatusTransitionAllowed(
  current: MissionPlaybook["status"],
  target: MissionPlaybook["status"],
): boolean {
  const allowed: Record<MissionPlaybook["status"], readonly MissionPlaybook["status"][]> = {
    draft: ["validated", "validation_failed"],
    validated: ["canary", "active", "rejected"],
    validation_failed: ["rejected"],
    rejected: [],
    canary: ["active", "deprecated", "suspended", "revoked"],
    active: ["deprecated", "suspended", "revoked"],
    suspended: ["active", "revoked", "archived"],
    deprecated: ["archived", "revoked"],
    revoked: ["archived"],
    archived: [],
  };
  return allowed[current].includes(target);
}

function lifecycleEventTypeForStatus(status: MissionPlaybook["status"]): MissionPlaybookLifecycleEventType {
  switch (status) {
    case "validated":
      return "mission.playbook.validated";
    case "validation_failed":
      return "mission.playbook.validation_failed";
    case "rejected":
      return "mission.playbook.rejected";
    case "canary":
      return "mission.playbook.canary.started";
    case "active":
      return "mission.playbook.activated";
    case "suspended":
      return "mission.playbook.suspended";
    case "deprecated":
      return "mission.playbook.deprecated";
    case "revoked":
      return "mission.playbook.revoked";
    case "archived":
      return "mission.playbook.archived";
    case "draft":
      return "mission.playbook.updated";
  }
}

function isTenantTargetedByRollout(playbook: MissionPlaybook, tenantId: string): boolean {
  if (playbook.rollout == null) {
    return false;
  }
  if (playbook.rollout.targetTenants.includes(tenantId)) {
    return true;
  }
  if (playbook.rollout.percentage <= 0) {
    return false;
  }
  return stableBucket(`${playbook.playbookId}:${playbook.version}:${tenantId}`) < normalizeRolloutPercentage(playbook.rollout.percentage);
}

function isPlaybookResolvable(
  playbook: MissionPlaybook,
  platformVersion: string,
  missionSchemaVersion: string,
  tenantId: string,
  allowCanary: boolean,
): boolean {
  if (playbook.status === "revoked" || playbook.status === "suspended" || playbook.status === "archived") {
    return false;
  }
  if (playbook.status === "canary" && !allowCanary) {
    return false;
  }
  return isPlaybookCompatible(playbook, platformVersion, missionSchemaVersion, tenantId);
}

function isPlaybookFallbackSafe(
  playbook: MissionPlaybook,
  platformVersion: string,
  missionSchemaVersion: string,
  tenantId: string,
): boolean {
  if (!isPlaybookResolvable(playbook, platformVersion, missionSchemaVersion, tenantId, false)) {
    return false;
  }
  return playbook.rollback?.rollbackAllowed === true;
}

function isPlaybookCompatible(
  playbook: MissionPlaybook,
  platformVersion: string,
  missionSchemaVersion: string,
  tenantId: string,
): boolean {
  const compatibility = playbook.compatibility;
  if (compatibility == null) {
    return false;
  }
  if (compatibility.authorizedTenantIds != null && compatibility.authorizedTenantIds.length > 0 && !compatibility.authorizedTenantIds.includes(tenantId)) {
    return false;
  }
  if (compareSemver(platformVersion, compatibility.minPlatformVersion) < 0) {
    return false;
  }
  return compatibility.compatibleMissionSchemaVersions.some((pattern) => versionMatchesPattern(missionSchemaVersion, pattern));
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map((value) => Number.parseInt(value, 10) || 0);
  const rightParts = right.split(".").map((value) => Number.parseInt(value, 10) || 0);
  const size = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < size; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function versionMatchesPattern(version: string, pattern: string): boolean {
  if (pattern.endsWith(".x")) {
    return version.startsWith(`${pattern.slice(0, -2)}.`);
  }
  return version === pattern;
}

function stableBucket(input: string): number {
  let value = 0;
  for (const char of input) {
    value = (value * 31 + char.charCodeAt(0)) % 100;
  }
  return value;
}

function normalizeRolloutPercentage(percentage: number): number {
  if (!Number.isFinite(percentage)) {
    return 0;
  }
  if (percentage > 0 && percentage <= 1) {
    return Math.min(100, Math.max(0, percentage * 100));
  }
  return Math.min(100, Math.max(0, percentage));
}

function resolutionAuditRef(
  policy: MissionPlaybookResolutionPolicy,
  playbook: MissionPlaybook,
  resolutionReason: MissionPlaybookResolutionResult["resolutionReason"],
): string {
  return `audit:mission_playbook_resolution:${policy.tenantId}:${policy.missionType}:${playbook.playbookId}:${playbook.version}:${resolutionReason}`;
}

function resolveAffectedMissionIds(
  repository: MissionRepository | undefined,
  tenantId: string | undefined,
  fromPlaybookId: string,
  fromVersion: string,
): string[] {
  if (repository == null || tenantId == null) {
    return [];
  }
  return repository.listMissions(tenantId)
    .filter((mission) =>
      mission.playbookBinding?.playbookId === fromPlaybookId
      && mission.playbookBinding?.playbookVersion === fromVersion
    )
    .map((mission) => mission.missionId);
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

  public backfillSession<T extends { readonly missionRef?: unknown }>(
    session: T,
    missionRef: MissionBinding,
  ): T & { readonly missionRef: MissionBinding } {
    return this.backfillTask(session, missionRef);
  }

  public backfillBatch<TTask extends { readonly missionRef?: unknown }, TSession extends { readonly missionRef?: unknown }>(input: {
    readonly tasks: readonly TTask[];
    readonly sessions: readonly TSession[];
    readonly resolveMissionRef: (record: TTask | TSession, kind: "task" | "session") => MissionBinding | null;
  }): {
    readonly tasks: readonly (TTask & { readonly missionRef?: unknown })[];
    readonly sessions: readonly (TSession & { readonly missionRef?: unknown })[];
    readonly report: {
      readonly taskCount: number;
      readonly sessionCount: number;
      readonly taskBackfilled: number;
      readonly sessionBackfilled: number;
      readonly unresolvedCount: number;
    };
  } {
    let taskBackfilled = 0;
    let sessionBackfilled = 0;
    let unresolvedCount = 0;
    const tasks = input.tasks.map((task) => {
      if (task.missionRef != null) {
        return task;
      }
      const missionRef = input.resolveMissionRef(task, "task");
      if (missionRef == null) {
        unresolvedCount += 1;
        return task;
      }
      taskBackfilled += 1;
      return this.backfillTask(task, missionRef);
    });
    const sessions = input.sessions.map((session) => {
      if (session.missionRef != null) {
        return session;
      }
      const missionRef = input.resolveMissionRef(session, "session");
      if (missionRef == null) {
        unresolvedCount += 1;
        return session;
      }
      sessionBackfilled += 1;
      return this.backfillSession(session, missionRef);
    });
    return {
      tasks,
      sessions,
      report: {
        taskCount: input.tasks.length,
        sessionCount: input.sessions.length,
        taskBackfilled,
        sessionBackfilled,
        unresolvedCount,
      },
    };
  }
}

export class MissionHomeRegionService {
  private readonly epochs = new Map<string, number>();
  private readonly readRoutes = new Map<string, {
    readonly homeRegion: string;
    readonly readReplicaRegions: readonly string[];
  }>();

  public assignHomeRegion(input: { readonly missionId: string; readonly region: string; readonly epoch?: number }): {
    readonly missionId: string;
    readonly region: string;
    readonly epoch: number;
  } {
    const epoch = input.epoch ?? (this.epochs.get(input.missionId) ?? 0) + 1;
    this.epochs.set(input.missionId, epoch);
    const current = this.readRoutes.get(input.missionId);
    this.readRoutes.set(input.missionId, {
      homeRegion: input.region,
      readReplicaRegions: current?.readReplicaRegions ?? [],
    });
    return { missionId: input.missionId, region: input.region, epoch };
  }

  public registerReadReplica(missionId: string, region: string): void {
    const current = this.readRoutes.get(missionId);
    if (current == null) {
      throwMissionError("mission.home_region_missing", "Mission read replica requires a home region", { missionId, region });
    }
    this.readRoutes.set(missionId, {
      ...current,
      readReplicaRegions: [...new Set([...current.readReplicaRegions, region])],
    });
  }

  public routeRead(input: {
    readonly missionId: string;
    readonly preferredRegion?: string | null;
    readonly consistency: "strong" | "eventual";
  }): {
    readonly missionId: string;
    readonly region: string;
    readonly source: "home" | "read_replica";
    readonly consistency: "strong" | "eventual";
  } {
    const route = this.readRoutes.get(input.missionId);
    if (route == null) {
      throwMissionError("mission.home_region_missing", "Mission read route requires a home region", { missionId: input.missionId });
    }
    const replica = input.consistency === "eventual" && input.preferredRegion != null
      ? route.readReplicaRegions.find((region) => region === input.preferredRegion)
      : undefined;
    return {
      missionId: input.missionId,
      region: replica ?? route.homeRegion,
      source: replica == null ? "home" : "read_replica",
      consistency: input.consistency,
    };
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
