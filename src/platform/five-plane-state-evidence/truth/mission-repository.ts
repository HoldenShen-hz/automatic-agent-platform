import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  buildMissionEtag,
  computeMissionSnapshotHash,
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  MissionContextSnapshotSchema,
  MissionEventEnvelopeSchema,
  MissionMembershipSchema,
  MissionRecordSchema,
  type MissionContextSnapshot,
  type MissionEventEnvelope,
  type MissionEventType,
  type MissionMembership,
  type MissionRecord,
  type RuntimeConstraintSet,
} from "../../contracts/mission/index.js";
import type { JsonValue, PrincipalRef } from "../../contracts/executable-contracts/index.js";

export interface CreateMissionRecordInput {
  readonly tenantId: string;
  readonly orgId?: string | null;
  readonly type?: MissionRecord["type"];
  readonly priority?: MissionRecord["priority"];
  readonly title: string;
  readonly description?: string | null;
  readonly objective: string;
  readonly successCriteria: readonly string[];
  readonly ownerPrincipalId: string;
  readonly accountablePrincipalId?: string | null;
  readonly domainId?: string | null;
  readonly policyRefs?: readonly string[];
  readonly riskProfileRef?: string | null;
  readonly budgetEnvelopeRef?: string | null;
  readonly knowledgeBoundaryRef?: string | null;
  readonly defaultWorkflowTemplateRefs?: readonly string[];
  readonly metadata?: JsonValue;
  readonly createdBy: string;
  readonly traceId: string;
  readonly correlationId: string;
  readonly missionId?: string;
  readonly createdAt?: string;
}

export interface AppendMissionEventInput {
  readonly eventType: MissionEventType;
  readonly missionId: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly correlationId: string;
  readonly payload: JsonValue;
  readonly occurredAt?: string;
  readonly eventId?: string;
}

export interface MissionRepository {
  createMission(input: CreateMissionRecordInput): MissionRecord;
  getMission(missionId: string): MissionRecord | null;
  listMissions(tenantId: string): MissionRecord[];
  updateMission(record: MissionRecord, event: AppendMissionEventInput): MissionRecord;
  addMembership(input: Omit<MissionMembership, "version"> & { version?: number }): MissionMembership;
  revokeMembership(missionId: string, principalId: string, revokedBy: string, traceId: string, correlationId: string): MissionMembership | null;
  revokeMembershipById(missionId: string, membershipId: string, revokedBy: string, traceId: string, correlationId: string): MissionMembership | null;
  listMemberships(missionId: string): MissionMembership[];
  listMissionTasks(missionId: string): MissionLinkedResource[];
  listMissionRuns(missionId: string): MissionLinkedResource[];
  listMissionEvidence(missionId: string): MissionLinkedResource[];
  listMissionKnowledge(missionId: string): MissionLinkedResource[];
  listMissionLearning(missionId: string): MissionLinkedResource[];
  linkResource(resource: MissionLinkedResource): MissionLinkedResource;
  createSnapshot(input: {
    missionId: string;
    taskId: string;
    confirmedTaskSpecId: string;
    runtimeConstraints?: RuntimeConstraintSet;
    traceId: string;
    correlationId: string;
    createdBy: string;
    createdAt?: string;
  }): MissionContextSnapshot;
  getSnapshot(missionSnapshotId: string): MissionContextSnapshot | null;
  appendEvent(input: AppendMissionEventInput): MissionEventEnvelope;
  listEvents(missionId: string): MissionEventEnvelope[];
}

export type MissionLinkedResourceType = "task" | "run" | "evidence" | "knowledge" | "learning";

export interface MissionLinkedResource {
  readonly id: string;
  readonly missionId: string;
  readonly tenantId: string;
  readonly type: MissionLinkedResourceType;
  readonly status: string;
  readonly title: string;
  readonly ref: string;
  readonly updatedAt: string;
  readonly metadata: JsonValue;
}

export class InMemoryMissionRepository implements MissionRepository {
  private readonly missions = new Map<string, MissionRecord>();
  private readonly memberships = new Map<string, MissionMembership>();
  private readonly snapshots = new Map<string, MissionContextSnapshot>();
  private readonly events = new Map<string, MissionEventEnvelope[]>();
  private readonly sequences = new Map<string, number>();
  private readonly linkedResources = new Map<string, MissionLinkedResource[]>();

  public createMission(input: CreateMissionRecordInput): MissionRecord {
    const timestamp = input.createdAt ?? nowIso();
    const missionId = input.missionId ?? newId("mis");
    if (this.missions.has(missionId)) {
      throw new Error("mission.duplicate_id");
    }
    const record = MissionRecordSchema.parse({
      missionId,
      tenantId: input.tenantId,
      orgId: input.orgId ?? null,
      type: input.type ?? "formal",
      status: "draft",
      priority: input.priority ?? "normal",
      title: input.title,
      description: input.description ?? null,
      objective: input.objective,
      successCriteria: [...input.successCriteria],
      ownerPrincipalId: input.ownerPrincipalId,
      accountablePrincipalId: input.accountablePrincipalId ?? null,
      domainId: input.domainId ?? null,
      policyRefs: [...(input.policyRefs ?? [])],
      riskProfileRef: input.riskProfileRef ?? null,
      budgetEnvelopeRef: input.budgetEnvelopeRef ?? null,
      knowledgeBoundaryRef: input.knowledgeBoundaryRef ?? null,
      defaultWorkflowTemplateRefs: [...(input.defaultWorkflowTemplateRefs ?? [])],
      metadata: input.metadata ?? {},
      freezeReason: null,
      createdAt: timestamp,
      createdBy: input.createdBy,
      updatedAt: timestamp,
      updatedBy: input.createdBy,
      archivedAt: null,
      archivedBy: null,
      version: 0,
      etag: buildMissionEtag(missionId, 0),
    });
    this.missions.set(missionId, record);
    this.appendEvent({
      eventType: "platform.mission.created",
      missionId,
      tenantId: record.tenantId,
      traceId: input.traceId,
      correlationId: input.correlationId,
      payload: { missionId, status: record.status },
      occurredAt: timestamp,
    });
    this.addMembership({
      membershipId: newId("mship"),
      missionId,
      tenantId: record.tenantId,
      principalType: "user",
      principalId: record.ownerPrincipalId,
      role: "owner",
      permissions: [
        "mission:read",
        "mission:update",
        "mission:manage_members",
        "mission:view_budget",
        "mission:view_evidence",
        "mission:bind_task",
        "mission:execute",
        "mission:handoff",
      ],
      deniedPermissions: [],
      status: "active",
      grantedBy: input.createdBy,
      grantedAt: timestamp,
      expiresAt: null,
      metadata: {},
    });
    return record;
  }

  public getMission(missionId: string): MissionRecord | null {
    return this.missions.get(missionId) ?? null;
  }

  public listMissions(tenantId: string): MissionRecord[] {
    return [...this.missions.values()].filter((mission) => mission.tenantId === tenantId);
  }

  public updateMission(record: MissionRecord, event: AppendMissionEventInput): MissionRecord {
    const current = this.missions.get(record.missionId);
    if (current == null) {
      throw new Error("mission.not_found");
    }
    if (record.version <= current.version) {
      throw new Error("mission.version_must_advance");
    }
    this.missions.set(record.missionId, MissionRecordSchema.parse(record));
    this.appendEvent(event);
    return record;
  }

  public addMembership(input: Omit<MissionMembership, "version"> & { version?: number }): MissionMembership {
    const membership = MissionMembershipSchema.parse({ ...input, version: input.version ?? 0 });
    this.memberships.set(membership.membershipId, membership);
    this.appendEvent({
      eventType: "platform.mission.membership_granted",
      missionId: membership.missionId,
      tenantId: membership.tenantId,
      traceId: `trace:${membership.membershipId}`,
      correlationId: `corr:${membership.membershipId}`,
      payload: { membershipId: membership.membershipId, principalId: membership.principalId, role: membership.role },
      occurredAt: membership.grantedAt,
    });
    return membership;
  }

  public revokeMembership(
    missionId: string,
    principalId: string,
    revokedBy: string,
    traceId: string,
    correlationId: string,
  ): MissionMembership | null {
    const current = [...this.memberships.values()].find((item) =>
      item.missionId === missionId && item.principalId === principalId && item.status === "active"
    );
    if (current == null) {
      return null;
    }
    const updated = MissionMembershipSchema.parse({ ...current, status: "revoked", version: current.version + 1 });
    this.memberships.set(updated.membershipId, updated);
    this.appendEvent({
      eventType: "platform.mission.membership_revoked",
      missionId,
      tenantId: updated.tenantId,
      traceId,
      correlationId,
      payload: { membershipId: updated.membershipId, principalId, revokedBy },
    });
    return updated;
  }

  public revokeMembershipById(
    missionId: string,
    membershipId: string,
    revokedBy: string,
    traceId: string,
    correlationId: string,
  ): MissionMembership | null {
    const current = this.memberships.get(membershipId);
    if (current == null || current.missionId !== missionId || current.status !== "active") {
      return null;
    }
    return this.revokeMembership(missionId, current.principalId, revokedBy, traceId, correlationId);
  }

  public listMemberships(missionId: string): MissionMembership[] {
    return [...this.memberships.values()].filter((membership) => membership.missionId === missionId);
  }

  public listMissionTasks(missionId: string): MissionLinkedResource[] {
    return this.listLinkedResources(missionId, "task");
  }

  public listMissionRuns(missionId: string): MissionLinkedResource[] {
    return this.listLinkedResources(missionId, "run");
  }

  public listMissionEvidence(missionId: string): MissionLinkedResource[] {
    return this.listLinkedResources(missionId, "evidence");
  }

  public listMissionKnowledge(missionId: string): MissionLinkedResource[] {
    return this.listLinkedResources(missionId, "knowledge");
  }

  public listMissionLearning(missionId: string): MissionLinkedResource[] {
    return this.listLinkedResources(missionId, "learning");
  }

  public linkResource(resource: MissionLinkedResource): MissionLinkedResource {
    const mission = this.getMission(resource.missionId);
    if (mission == null) {
      throw new Error("mission.not_found");
    }
    if (mission.tenantId !== resource.tenantId) {
      throw new Error("mission.tenant_mismatch");
    }
    this.upsertLinkedResource(resource);
    return resource;
  }

  public createSnapshot(input: {
    missionId: string;
    taskId: string;
    confirmedTaskSpecId: string;
    runtimeConstraints?: RuntimeConstraintSet;
    traceId: string;
    correlationId: string;
    createdBy: string;
    createdAt?: string;
  }): MissionContextSnapshot {
    const mission = this.getMission(input.missionId);
    if (mission == null) {
      throw new Error("mission.not_found");
    }
    const timestamp = input.createdAt ?? nowIso();
    const base = {
      missionSnapshotId: newId("msnap"),
      missionId: mission.missionId,
      missionVersion: mission.version,
      tenantId: mission.tenantId,
      orgId: mission.orgId,
      taskId: input.taskId,
      confirmedTaskSpecId: input.confirmedTaskSpecId,
      runtimeConstraints: input.runtimeConstraints ?? DEFAULT_RUNTIME_CONSTRAINT_SET,
      mission,
      memberships: this.listMemberships(mission.missionId),
      signature: null,
      traceId: input.traceId,
      correlationId: input.correlationId,
      createdAt: timestamp,
      createdBy: input.createdBy,
    };
    const snapshot = MissionContextSnapshotSchema.parse({
      ...base,
      payloadHash: computeMissionSnapshotHash(base),
    });
    this.snapshots.set(snapshot.missionSnapshotId, snapshot);
    this.upsertLinkedResource({
      id: input.taskId,
      missionId: mission.missionId,
      tenantId: mission.tenantId,
      type: "task",
      status: "bound",
      title: `Task ${input.taskId}`,
      ref: input.confirmedTaskSpecId,
      updatedAt: timestamp,
      metadata: { missionSnapshotId: snapshot.missionSnapshotId },
    });
    this.upsertLinkedResource({
      id: snapshot.missionSnapshotId,
      missionId: mission.missionId,
      tenantId: mission.tenantId,
      type: "evidence",
      status: "recorded",
      title: "Mission context snapshot",
      ref: snapshot.payloadHash,
      updatedAt: timestamp,
      metadata: { taskId: input.taskId, confirmedTaskSpecId: input.confirmedTaskSpecId },
    });
    this.appendEvent({
      eventType: "platform.mission.snapshot_created",
      missionId: mission.missionId,
      tenantId: mission.tenantId,
      traceId: input.traceId,
      correlationId: input.correlationId,
      payload: {
        missionSnapshotId: snapshot.missionSnapshotId,
        taskId: input.taskId,
        confirmedTaskSpecId: input.confirmedTaskSpecId,
        payloadHash: snapshot.payloadHash,
      },
      occurredAt: timestamp,
    });
    return snapshot;
  }

  public getSnapshot(missionSnapshotId: string): MissionContextSnapshot | null {
    return this.snapshots.get(missionSnapshotId) ?? null;
  }

  public appendEvent(input: AppendMissionEventInput): MissionEventEnvelope {
    const sequenceKey = `${input.tenantId}:mission:${input.missionId}`;
    const next = this.sequences.get(sequenceKey) ?? 1;
    this.sequences.set(sequenceKey, next + 1);
    const event = MissionEventEnvelopeSchema.parse({
      eventId: input.eventId ?? newId("mevt"),
      eventType: input.eventType,
      tenantId: input.tenantId,
      aggregateType: "mission",
      aggregateId: input.missionId,
      aggregateSeq: next,
      traceId: input.traceId,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt ?? nowIso(),
      payload: input.payload,
    });
    const list = this.events.get(input.missionId) ?? [];
    list.push(event);
    this.events.set(input.missionId, list);
    return event;
  }

  public listEvents(missionId: string): MissionEventEnvelope[] {
    return [...(this.events.get(missionId) ?? [])];
  }

  private upsertLinkedResource(resource: MissionLinkedResource): void {
    const list = this.linkedResources.get(resource.missionId) ?? [];
    const next = list.filter((item) => item.id !== resource.id || item.type !== resource.type);
    next.push(resource);
    next.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
    this.linkedResources.set(resource.missionId, next);
  }

  private listLinkedResources(missionId: string, type: MissionLinkedResourceType): MissionLinkedResource[] {
    return [...(this.linkedResources.get(missionId) ?? [])].filter((item) => item.type === type);
  }
}

export function missionPrincipalFromApi(principal: PrincipalRef): string {
  return principal.principalId;
}
