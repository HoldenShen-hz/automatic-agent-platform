import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  buildMissionEtag,
  computeMissionSnapshotHash,
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  MissionContextSnapshotSchema,
  MissionEventEnvelopeSchema,
  MissionMembershipSchema,
  MissionPlaybookBindingSchema,
  MissionRecordSchema,
  type MissionContextSnapshot,
  type MissionEventEnvelope,
  type MissionEventType,
  type MissionMembership,
  type MissionPlaybookBinding,
  type MissionRecord,
  type RuntimeConstraintSet,
} from "../../contracts/mission/index.js";
import type { JsonValue, PrincipalRef } from "../../contracts/executable-contracts/index.js";
import type { AuthoritativeSqlDatabase } from "./authoritative-sql-database.js";

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
  readonly playbookBinding?: MissionPlaybookBinding;
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

const MISSION_EVENT_AGGREGATE_TYPE = "mission";
const MISSION_RESOURCE_AGGREGATE_TYPE = "mission_resource";
const MISSION_RESOURCE_LINKED_EVENT_TYPE = "platform.mission.resource_linked";
const MISSION_METADATA_ENVELOPE_KEY = "__platformMissionRecord";

interface MissionRecordRow {
  missionId: string;
  tenantId: string;
  orgId: string | null;
  type: MissionRecord["type"];
  status: MissionRecord["status"];
  priority: MissionRecord["priority"];
  title: string;
  description: string | null;
  objective: string;
  successCriteriaJson: string;
  ownerPrincipalId: string;
  accountablePrincipalId: string | null;
  domainId: string | null;
  policyRefsJson: string;
  riskProfileRef: string | null;
  budgetEnvelopeRef: string | null;
  knowledgeBoundaryRef: string | null;
  defaultWorkflowTemplateRefsJson: string;
  metadataJson: string;
  freezeReason: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt: string | null;
  archivedBy: string | null;
  version: number;
  etag: string;
}

interface MissionMembershipRow {
  membershipId: string;
  missionId: string;
  tenantId: string;
  principalType: MissionMembership["principalType"];
  principalId: string;
  role: MissionMembership["role"];
  permissionsJson: string;
  deniedPermissionsJson: string;
  status: MissionMembership["status"];
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  metadataJson: string;
  version: number;
}

interface MissionEventRow {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateSeq: number;
  payloadJson: string;
  occurredAt: string;
}

interface MissionSequenceRow {
  nextSequence: number;
}

interface MissionSnapshotRow {
  snapshotJson: string;
}

interface MissionResourceEnvelope {
  readonly resource: MissionLinkedResource;
}

interface MissionEventEnvelopePayload {
  readonly payload: JsonValue;
  readonly tenantId: string;
  readonly traceId: string;
  readonly correlationId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonValue(raw: string): JsonValue {
  return JSON.parse(raw) as JsonValue;
}

function decodeMissionMetadata(metadataJson: string): {
  metadata: JsonValue;
  playbookBinding?: MissionPlaybookBinding;
} {
  const parsed = parseJsonValue(metadataJson);
  if (isRecord(parsed) && isRecord(parsed[MISSION_METADATA_ENVELOPE_KEY])) {
    const envelope = parsed[MISSION_METADATA_ENVELOPE_KEY] as Record<string, unknown>;
    const playbookBinding = envelope["playbookBinding"] == null
      ? undefined
      : MissionPlaybookBindingSchema.parse(envelope["playbookBinding"]);
    return {
      metadata: (envelope["metadata"] as JsonValue | undefined) ?? {},
      ...(playbookBinding == null ? {} : { playbookBinding }),
    };
  }
  return { metadata: parsed };
}

function encodeMissionMetadata(record: Pick<MissionRecord, "metadata" | "playbookBinding">): string {
  return JSON.stringify({
    [MISSION_METADATA_ENVELOPE_KEY]: {
      metadata: record.metadata,
      playbookBinding: record.playbookBinding ?? null,
    },
  });
}

function readMissionRecord(row: MissionRecordRow | undefined): MissionRecord | null {
  if (row == null) {
    return null;
  }
  const decoded = decodeMissionMetadata(row.metadataJson);
  return MissionRecordSchema.parse({
    missionId: row.missionId,
    tenantId: row.tenantId,
    orgId: row.orgId,
    type: row.type,
    status: row.status,
    priority: row.priority,
    title: row.title,
    description: row.description,
    objective: row.objective,
    successCriteria: parseJsonValue(row.successCriteriaJson),
    ownerPrincipalId: row.ownerPrincipalId,
    accountablePrincipalId: row.accountablePrincipalId,
    domainId: row.domainId,
    policyRefs: parseJsonValue(row.policyRefsJson),
    riskProfileRef: row.riskProfileRef,
    budgetEnvelopeRef: row.budgetEnvelopeRef,
    knowledgeBoundaryRef: row.knowledgeBoundaryRef,
    defaultWorkflowTemplateRefs: parseJsonValue(row.defaultWorkflowTemplateRefsJson),
    metadata: decoded.metadata,
    ...(decoded.playbookBinding == null ? {} : { playbookBinding: decoded.playbookBinding }),
    freezeReason: row.freezeReason,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    archivedAt: row.archivedAt,
    archivedBy: row.archivedBy,
    version: Number(row.version),
    etag: row.etag,
  });
}

function readMissionMembership(row: MissionMembershipRow): MissionMembership {
  return MissionMembershipSchema.parse({
    membershipId: row.membershipId,
    missionId: row.missionId,
    tenantId: row.tenantId,
    principalType: row.principalType,
    principalId: row.principalId,
    role: row.role,
    permissions: parseJsonValue(row.permissionsJson),
    deniedPermissions: parseJsonValue(row.deniedPermissionsJson),
    status: row.status,
    grantedBy: row.grantedBy,
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
    metadata: parseJsonValue(row.metadataJson),
    version: Number(row.version),
  });
}

function readMissionEvent(row: MissionEventRow): MissionEventEnvelope {
  const parsed = parseJsonValue(row.payloadJson);
  const envelope = isRecord(parsed) ? parsed as Partial<MissionEventEnvelopePayload> : {};
  return MissionEventEnvelopeSchema.parse({
    eventId: row.eventId,
    eventType: row.eventType,
    tenantId: typeof envelope.tenantId === "string" ? envelope.tenantId : "",
    aggregateType: MISSION_EVENT_AGGREGATE_TYPE,
    aggregateId: row.aggregateId,
    aggregateSeq: Number(row.aggregateSeq),
    traceId: typeof envelope.traceId === "string" ? envelope.traceId : "",
    correlationId: typeof envelope.correlationId === "string" ? envelope.correlationId : "",
    occurredAt: row.occurredAt,
    payload: envelope.payload ?? parsed,
  });
}

function readMissionResourceEnvelope(row: MissionEventRow): MissionLinkedResource | null {
  const parsed = parseJsonValue(row.payloadJson);
  const envelope = isRecord(parsed) ? parsed as Partial<MissionResourceEnvelope> : {};
  const resource = envelope.resource ?? parsed;
  if (!isRecord(resource)) {
    return null;
  }
  return {
    id: String(resource["id"] ?? ""),
    missionId: String(resource["missionId"] ?? ""),
    tenantId: String(resource["tenantId"] ?? ""),
    type: String(resource["type"] ?? "") as MissionLinkedResourceType,
    status: String(resource["status"] ?? ""),
    title: String(resource["title"] ?? ""),
    ref: String(resource["ref"] ?? ""),
    updatedAt: String(resource["updatedAt"] ?? row.occurredAt),
    metadata: (resource["metadata"] as JsonValue | undefined) ?? {},
  };
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
      playbookBinding: input.playbookBinding == null ? undefined : MissionPlaybookBindingSchema.parse(input.playbookBinding),
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

export class SqliteMissionRepository implements MissionRepository {
  public constructor(private readonly db: AuthoritativeSqlDatabase) {}

  public createMission(input: CreateMissionRecordInput): MissionRecord {
    return this.db.transaction(() => {
      const timestamp = input.createdAt ?? nowIso();
      const missionId = input.missionId ?? newId("mis");
      if (this.getMission(missionId) != null) {
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
        playbookBinding: input.playbookBinding == null ? undefined : MissionPlaybookBindingSchema.parse(input.playbookBinding),
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
      this.db.connection.prepare(
        `INSERT INTO mission_records (
          mission_id, tenant_id, org_id, type, status, priority, title, description, objective,
          success_criteria_json, owner_principal_id, accountable_principal_id, domain_id,
          policy_refs_json, risk_profile_ref, budget_envelope_ref, knowledge_boundary_ref,
          default_workflow_template_refs_json, metadata_json, freeze_reason, created_at, created_by,
          updated_at, updated_by, archived_at, archived_by, version, etag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.missionId,
        record.tenantId,
        record.orgId,
        record.type,
        record.status,
        record.priority,
        record.title,
        record.description,
        record.objective,
        JSON.stringify(record.successCriteria),
        record.ownerPrincipalId,
        record.accountablePrincipalId,
        record.domainId,
        JSON.stringify(record.policyRefs),
        record.riskProfileRef,
        record.budgetEnvelopeRef,
        record.knowledgeBoundaryRef,
        JSON.stringify(record.defaultWorkflowTemplateRefs),
        encodeMissionMetadata(record),
        record.freezeReason,
        record.createdAt,
        record.createdBy,
        record.updatedAt,
        record.updatedBy,
        record.archivedAt,
        record.archivedBy,
        record.version,
        record.etag,
      );
      this.appendMissionEventInternal({
        eventType: "platform.mission.created",
        missionId,
        tenantId: record.tenantId,
        traceId: input.traceId,
        correlationId: input.correlationId,
        payload: { missionId, status: record.status },
        occurredAt: timestamp,
      });
      this.addMembershipInternal({
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
    });
  }

  public getMission(missionId: string): MissionRecord | null {
    const row = this.db.connection.prepare(
      `SELECT
        mission_id AS missionId,
        tenant_id AS tenantId,
        org_id AS orgId,
        type,
        status,
        priority,
        title,
        description,
        objective,
        success_criteria_json AS successCriteriaJson,
        owner_principal_id AS ownerPrincipalId,
        accountable_principal_id AS accountablePrincipalId,
        domain_id AS domainId,
        policy_refs_json AS policyRefsJson,
        risk_profile_ref AS riskProfileRef,
        budget_envelope_ref AS budgetEnvelopeRef,
        knowledge_boundary_ref AS knowledgeBoundaryRef,
        default_workflow_template_refs_json AS defaultWorkflowTemplateRefsJson,
        metadata_json AS metadataJson,
        freeze_reason AS freezeReason,
        created_at AS createdAt,
        created_by AS createdBy,
        updated_at AS updatedAt,
        updated_by AS updatedBy,
        archived_at AS archivedAt,
        archived_by AS archivedBy,
        version,
        etag
       FROM mission_records
       WHERE mission_id = ?
         AND is_deleted = 0`,
    ).get(missionId) as MissionRecordRow | undefined;
    return readMissionRecord(row);
  }

  public listMissions(tenantId: string): MissionRecord[] {
    const rows = this.db.connection.prepare(
      `SELECT
        mission_id AS missionId,
        tenant_id AS tenantId,
        org_id AS orgId,
        type,
        status,
        priority,
        title,
        description,
        objective,
        success_criteria_json AS successCriteriaJson,
        owner_principal_id AS ownerPrincipalId,
        accountable_principal_id AS accountablePrincipalId,
        domain_id AS domainId,
        policy_refs_json AS policyRefsJson,
        risk_profile_ref AS riskProfileRef,
        budget_envelope_ref AS budgetEnvelopeRef,
        knowledge_boundary_ref AS knowledgeBoundaryRef,
        default_workflow_template_refs_json AS defaultWorkflowTemplateRefsJson,
        metadata_json AS metadataJson,
        freeze_reason AS freezeReason,
        created_at AS createdAt,
        created_by AS createdBy,
        updated_at AS updatedAt,
        updated_by AS updatedBy,
        archived_at AS archivedAt,
        archived_by AS archivedBy,
        version,
        etag
       FROM mission_records
       WHERE tenant_id = ?
         AND is_deleted = 0
       ORDER BY updated_at DESC, mission_id ASC`,
    ).all(tenantId) as unknown as MissionRecordRow[];
    return rows.map((row) => readMissionRecord(row)).filter((row): row is MissionRecord => row !== null);
  }

  public updateMission(record: MissionRecord, event: AppendMissionEventInput): MissionRecord {
    return this.db.transaction(() => {
      const current = this.getMission(record.missionId);
      if (current == null) {
        throw new Error("mission.not_found");
      }
      if (record.version <= current.version) {
        throw new Error("mission.version_must_advance");
      }
      const normalized = MissionRecordSchema.parse(record);
      this.db.connection.prepare(
        `UPDATE mission_records
         SET tenant_id = ?,
             org_id = ?,
             type = ?,
             status = ?,
             priority = ?,
             title = ?,
             description = ?,
             objective = ?,
             success_criteria_json = ?,
             owner_principal_id = ?,
             accountable_principal_id = ?,
             domain_id = ?,
             policy_refs_json = ?,
             risk_profile_ref = ?,
             budget_envelope_ref = ?,
             knowledge_boundary_ref = ?,
             default_workflow_template_refs_json = ?,
             metadata_json = ?,
             freeze_reason = ?,
             updated_at = ?,
             updated_by = ?,
             archived_at = ?,
             archived_by = ?,
             version = ?,
             etag = ?
         WHERE mission_id = ?
           AND is_deleted = 0`,
      ).run(
        normalized.tenantId,
        normalized.orgId,
        normalized.type,
        normalized.status,
        normalized.priority,
        normalized.title,
        normalized.description,
        normalized.objective,
        JSON.stringify(normalized.successCriteria),
        normalized.ownerPrincipalId,
        normalized.accountablePrincipalId,
        normalized.domainId,
        JSON.stringify(normalized.policyRefs),
        normalized.riskProfileRef,
        normalized.budgetEnvelopeRef,
        normalized.knowledgeBoundaryRef,
        JSON.stringify(normalized.defaultWorkflowTemplateRefs),
        encodeMissionMetadata(normalized),
        normalized.freezeReason,
        normalized.updatedAt,
        normalized.updatedBy,
        normalized.archivedAt,
        normalized.archivedBy,
        normalized.version,
        normalized.etag,
        normalized.missionId,
      );
      this.appendMissionEventInternal(event);
      return normalized;
    });
  }

  public addMembership(input: Omit<MissionMembership, "version"> & { version?: number }): MissionMembership {
    return this.db.transaction(() => this.addMembershipInternal(input));
  }

  public revokeMembership(
    missionId: string,
    principalId: string,
    revokedBy: string,
    traceId: string,
    correlationId: string,
  ): MissionMembership | null {
    return this.db.transaction(() => {
      const row = this.db.connection.prepare(this.activeMembershipSelectSql("principal")).get(missionId, principalId) as
        | MissionMembershipRow
        | undefined;
      if (row == null) {
        return null;
      }
      return this.revokeMembershipRow(row, revokedBy, traceId, correlationId);
    });
  }

  public revokeMembershipById(
    missionId: string,
    membershipId: string,
    revokedBy: string,
    traceId: string,
    correlationId: string,
  ): MissionMembership | null {
    return this.db.transaction(() => {
      const row = this.db.connection.prepare(this.activeMembershipSelectSql("membership")).get(missionId, membershipId) as
        | MissionMembershipRow
        | undefined;
      if (row == null) {
        return null;
      }
      return this.revokeMembershipRow(row, revokedBy, traceId, correlationId);
    });
  }

  public listMemberships(missionId: string): MissionMembership[] {
    const rows = this.db.connection.prepare(
      `SELECT
        membership_id AS membershipId,
        mission_id AS missionId,
        tenant_id AS tenantId,
        principal_type AS principalType,
        principal_id AS principalId,
        role,
        permissions_json AS permissionsJson,
        denied_permissions_json AS deniedPermissionsJson,
        status,
        granted_by AS grantedBy,
        granted_at AS grantedAt,
        expires_at AS expiresAt,
        metadata_json AS metadataJson,
        version
       FROM mission_memberships
       WHERE mission_id = ?
         AND is_deleted = 0
       ORDER BY granted_at ASC, membership_id ASC`,
    ).all(missionId) as unknown as MissionMembershipRow[];
    return rows.map((row) => readMissionMembership(row));
  }

  public listMissionTasks(missionId: string): MissionLinkedResource[] {
    return this.listMissionResourcesByType(missionId, "task");
  }

  public listMissionRuns(missionId: string): MissionLinkedResource[] {
    return this.listMissionResourcesByType(missionId, "run");
  }

  public listMissionEvidence(missionId: string): MissionLinkedResource[] {
    return this.listMissionResourcesByType(missionId, "evidence");
  }

  public listMissionKnowledge(missionId: string): MissionLinkedResource[] {
    return this.listMissionResourcesByType(missionId, "knowledge");
  }

  public listMissionLearning(missionId: string): MissionLinkedResource[] {
    return this.listMissionResourcesByType(missionId, "learning");
  }

  public linkResource(resource: MissionLinkedResource): MissionLinkedResource {
    return this.db.transaction(() => {
      this.assertMissionTenant(resource.missionId, resource.tenantId);
      this.persistLinkedResource(resource);
      return resource;
    });
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
    return this.db.transaction(() => {
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
      this.db.connection.prepare(
        `INSERT INTO mission_context_snapshots (
          mission_snapshot_id, mission_id, mission_version, tenant_id, org_id, task_id,
          confirmed_task_spec_id, snapshot_json, payload_hash, signature, trace_id,
          correlation_id, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        snapshot.missionSnapshotId,
        snapshot.missionId,
        snapshot.missionVersion,
        snapshot.tenantId,
        snapshot.orgId,
        snapshot.taskId,
        snapshot.confirmedTaskSpecId,
        JSON.stringify(snapshot),
        snapshot.payloadHash,
        snapshot.signature,
        snapshot.traceId,
        snapshot.correlationId,
        snapshot.createdAt,
        snapshot.createdBy,
      );
      this.persistLinkedResource({
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
      this.persistLinkedResource({
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
      this.appendMissionEventInternal({
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
    });
  }

  public getSnapshot(missionSnapshotId: string): MissionContextSnapshot | null {
    const row = this.db.connection.prepare(
      `SELECT snapshot_json AS snapshotJson
       FROM mission_context_snapshots
       WHERE mission_snapshot_id = ?
         AND is_deleted = 0`,
    ).get(missionSnapshotId) as MissionSnapshotRow | undefined;
    if (row == null) {
      return null;
    }
    return MissionContextSnapshotSchema.parse(parseJsonValue(row.snapshotJson));
  }

  public appendEvent(input: AppendMissionEventInput): MissionEventEnvelope {
    return this.db.transaction(() => this.appendMissionEventInternal(input));
  }

  public listEvents(missionId: string): MissionEventEnvelope[] {
    const rows = this.db.connection.prepare(
      `SELECT
        event_id AS eventId,
        event_type AS eventType,
        aggregate_id AS aggregateId,
        aggregate_seq AS aggregateSeq,
        payload_json AS payloadJson,
        occurred_at AS occurredAt
       FROM runtime_event_log
       WHERE aggregate_type = ?
         AND aggregate_id = ?
       ORDER BY aggregate_seq ASC`,
    ).all(MISSION_EVENT_AGGREGATE_TYPE, missionId) as unknown as MissionEventRow[];
    return rows.map((row) => readMissionEvent(row));
  }

  private addMembershipInternal(input: Omit<MissionMembership, "version"> & { version?: number }): MissionMembership {
    const membership = MissionMembershipSchema.parse({ ...input, version: input.version ?? 0 });
    this.persistMembership(membership, {
      actorId: membership.grantedBy,
      persistedAt: membership.grantedAt,
    });
    this.appendMissionEventInternal({
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

  private persistMembership(
    membership: MissionMembership,
    options: {
      actorId: string;
      persistedAt: string;
    },
  ): void {
    this.db.connection.prepare(
      `INSERT OR REPLACE INTO mission_memberships (
        membership_id, mission_id, tenant_id, principal_type, principal_id, role,
        permissions_json, denied_permissions_json, status, granted_by, granted_at,
        expires_at, metadata_json, version, created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      membership.membershipId,
      membership.missionId,
      membership.tenantId,
      membership.principalType,
      membership.principalId,
      membership.role,
      JSON.stringify(membership.permissions),
      JSON.stringify(membership.deniedPermissions),
      membership.status,
      membership.grantedBy,
      membership.grantedAt,
      membership.expiresAt,
      JSON.stringify(membership.metadata),
      membership.version,
      options.persistedAt,
      options.actorId,
      options.persistedAt,
      options.actorId,
    );
  }

  private revokeMembershipRow(
    row: MissionMembershipRow,
    revokedBy: string,
    traceId: string,
    correlationId: string,
  ): MissionMembership {
    const updated = MissionMembershipSchema.parse({ ...readMissionMembership(row), status: "revoked", version: Number(row.version) + 1 });
    this.persistMembership(updated, {
      actorId: revokedBy,
      persistedAt: nowIso(),
    });
    this.appendMissionEventInternal({
      eventType: "platform.mission.membership_revoked",
      missionId: updated.missionId,
      tenantId: updated.tenantId,
      traceId,
      correlationId,
      payload: { membershipId: updated.membershipId, principalId: updated.principalId, revokedBy },
    });
    return updated;
  }

  private appendMissionEventInternal(input: AppendMissionEventInput): MissionEventEnvelope {
    const occurredAt = input.occurredAt ?? nowIso();
    const aggregateSeq = this.nextSequence(input.tenantId, MISSION_EVENT_AGGREGATE_TYPE, input.missionId);
    const event = MissionEventEnvelopeSchema.parse({
      eventId: input.eventId ?? newId("mevt"),
      eventType: input.eventType,
      tenantId: input.tenantId,
      aggregateType: MISSION_EVENT_AGGREGATE_TYPE,
      aggregateId: input.missionId,
      aggregateSeq,
      traceId: input.traceId,
      correlationId: input.correlationId,
      occurredAt,
      payload: input.payload,
    });
    this.db.connection.prepare(
      `INSERT INTO runtime_event_log (
        event_id, event_type, aggregate_type, aggregate_id, aggregate_seq, payload_json, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      event.eventId,
      event.eventType,
      event.aggregateType,
      event.aggregateId,
      event.aggregateSeq,
      JSON.stringify({
        payload: event.payload,
        tenantId: event.tenantId,
        traceId: event.traceId,
        correlationId: event.correlationId,
      }),
      event.occurredAt,
    );
    return event;
  }

  private persistLinkedResource(resource: MissionLinkedResource): void {
    const aggregateSeq = this.nextSequence(resource.tenantId, MISSION_RESOURCE_AGGREGATE_TYPE, resource.missionId);
    this.db.connection.prepare(
      `INSERT INTO runtime_event_log (
        event_id, event_type, aggregate_type, aggregate_id, aggregate_seq, payload_json, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId("mevt"),
      MISSION_RESOURCE_LINKED_EVENT_TYPE,
      MISSION_RESOURCE_AGGREGATE_TYPE,
      resource.missionId,
      aggregateSeq,
      JSON.stringify({ resource }),
      resource.updatedAt,
    );
  }

  private nextSequence(tenantId: string, aggregateType: string, aggregateId: string): number {
    const row = this.db.connection.prepare(
      `SELECT next_sequence AS nextSequence
       FROM mission_event_sequences
       WHERE tenant_id = ?
         AND aggregate_type = ?
         AND aggregate_id = ?`,
    ).get(tenantId, aggregateType, aggregateId) as MissionSequenceRow | undefined;
    const next = row?.nextSequence ?? 1;
    this.db.connection.prepare(
      `INSERT INTO mission_event_sequences (tenant_id, aggregate_type, aggregate_id, next_sequence)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tenant_id, aggregate_type, aggregate_id)
       DO UPDATE SET next_sequence = excluded.next_sequence`,
    ).run(tenantId, aggregateType, aggregateId, next + 1);
    return Number(next);
  }

  private assertMissionTenant(missionId: string, tenantId: string): MissionRecord {
    const mission = this.getMission(missionId);
    if (mission == null) {
      throw new Error("mission.not_found");
    }
    if (mission.tenantId !== tenantId) {
      throw new Error("mission.tenant_mismatch");
    }
    return mission;
  }

  private listMissionResourcesByType(missionId: string, type: MissionLinkedResourceType): MissionLinkedResource[] {
    const resources = new Map<string, MissionLinkedResource>();
    for (const derived of this.deriveSnapshotResources(missionId, type)) {
      resources.set(`${derived.type}:${derived.id}`, derived);
    }
    const rows = this.db.connection.prepare(
      `SELECT
        event_id AS eventId,
        event_type AS eventType,
        aggregate_id AS aggregateId,
        aggregate_seq AS aggregateSeq,
        payload_json AS payloadJson,
        occurred_at AS occurredAt
       FROM runtime_event_log
       WHERE aggregate_type = ?
         AND aggregate_id = ?
         AND event_type = ?
       ORDER BY aggregate_seq ASC`,
    ).all(MISSION_RESOURCE_AGGREGATE_TYPE, missionId, MISSION_RESOURCE_LINKED_EVENT_TYPE) as unknown as MissionEventRow[];
    for (const row of rows) {
      const resource = readMissionResourceEnvelope(row);
      if (resource == null || resource.type !== type) {
        continue;
      }
      resources.set(`${resource.type}:${resource.id}`, resource);
    }
    return [...resources.values()]
      .filter((resource) => resource.type === type)
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
  }

  private deriveSnapshotResources(missionId: string, type: MissionLinkedResourceType): MissionLinkedResource[] {
    if (type !== "task" && type !== "evidence") {
      return [];
    }
    const rows = this.db.connection.prepare(
      `SELECT snapshot_json AS snapshotJson
       FROM mission_context_snapshots
       WHERE mission_id = ?
         AND is_deleted = 0
       ORDER BY created_at ASC`,
    ).all(missionId) as unknown as MissionSnapshotRow[];
    const resources: MissionLinkedResource[] = [];
    for (const row of rows) {
      const snapshot = MissionContextSnapshotSchema.parse(parseJsonValue(row.snapshotJson));
      if (type === "task") {
        resources.push({
          id: snapshot.taskId,
          missionId: snapshot.missionId,
          tenantId: snapshot.tenantId,
          type: "task" as const,
          status: "bound",
          title: `Task ${snapshot.taskId}`,
          ref: snapshot.confirmedTaskSpecId,
          updatedAt: snapshot.createdAt,
          metadata: { missionSnapshotId: snapshot.missionSnapshotId },
        });
        continue;
      }
      resources.push({
        id: snapshot.missionSnapshotId,
        missionId: snapshot.missionId,
        tenantId: snapshot.tenantId,
        type: "evidence" as const,
        status: "recorded",
        title: "Mission context snapshot",
        ref: snapshot.payloadHash,
        updatedAt: snapshot.createdAt,
        metadata: { taskId: snapshot.taskId, confirmedTaskSpecId: snapshot.confirmedTaskSpecId },
      });
    }
    return resources;
  }

  private activeMembershipSelectSql(selector: "principal" | "membership"): string {
    const field = selector === "principal" ? "principal_id" : "membership_id";
    const order = selector === "principal" ? "ORDER BY version DESC LIMIT 1" : "";
    return `SELECT
      membership_id AS membershipId,
      mission_id AS missionId,
      tenant_id AS tenantId,
      principal_type AS principalType,
      principal_id AS principalId,
      role,
      permissions_json AS permissionsJson,
      denied_permissions_json AS deniedPermissionsJson,
      status,
      granted_by AS grantedBy,
      granted_at AS grantedAt,
      expires_at AS expiresAt,
      metadata_json AS metadataJson,
      version
     FROM mission_memberships
     WHERE mission_id = ?
       AND ${field} = ?
       AND status = 'active'
       AND is_deleted = 0
     ${order}`;
  }
}

export function missionPrincipalFromApi(principal: PrincipalRef): string {
  return principal.principalId;
}
