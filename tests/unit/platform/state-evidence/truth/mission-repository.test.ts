import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import {
  InMemoryMissionRepository,
  SqliteMissionRepository,
  missionPrincipalFromApi,
  type CreateMissionRecordInput,
  type AppendMissionEventInput,
} from "../../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

describe("InMemoryMissionRepository", () => {
  let repository: InMemoryMissionRepository;

  const baseInput: CreateMissionRecordInput = {
    tenantId: "tenant-1",
    title: "Test Mission",
    objective: "Complete the test objective",
    successCriteria: ["criterion 1", "criterion 2"],
    ownerPrincipalId: "user-1",
    createdBy: "creator-1",
    traceId: "trace-1",
    correlationId: "corr-1",
  };

  beforeEach(() => {
    repository = new InMemoryMissionRepository();
  });

  describe("createMission", () => {
    it("should create a mission with default values", () => {
      const mission = repository.createMission(baseInput);

      assert.strictEqual(mission.title, "Test Mission");
      assert.strictEqual(mission.tenantId, "tenant-1");
      assert.strictEqual(mission.status, "draft");
      assert.strictEqual(mission.priority, "normal");
      assert.strictEqual(mission.type, "formal");
      assert.strictEqual(mission.version, 0);
      assert.ok(mission.missionId.startsWith("mis_"));
      assert.ok(mission.etag.includes(mission.missionId));
    });

    it("should create mission with custom optional fields", () => {
      const input: CreateMissionRecordInput = {
        ...baseInput,
        type: "ad_hoc",
        priority: "high",
        description: "A description",
        orgId: "org-1",
      };

      const mission = repository.createMission(input);

      assert.strictEqual(mission.type, "ad_hoc");
      assert.strictEqual(mission.priority, "high");
      assert.strictEqual(mission.description, "A description");
      assert.strictEqual(mission.orgId, "org-1");
    });

    it("should throw on duplicate mission ID", () => {
      const inputWithId: CreateMissionRecordInput = {
        ...baseInput,
        missionId: "mis-duplicate",
      };

      repository.createMission(inputWithId);

      assert.throws(
        () => repository.createMission({ ...inputWithId }),
        { message: "mission.duplicate_id" },
      );
    });

    it("should add owner as membership with correct permissions", () => {
      const mission = repository.createMission(baseInput);
      const memberships = repository.listMemberships(mission.missionId);

      assert.strictEqual(memberships.length, 1);
      assert.strictEqual(memberships[0].principalId, "user-1");
      assert.strictEqual(memberships[0].role, "owner");
      assert.ok(memberships[0].permissions.includes("mission:read"));
      assert.ok(memberships[0].permissions.includes("mission:execute"));
    });

    it("should append creation event", () => {
      const mission = repository.createMission(baseInput);
      const events = repository.listEvents(mission.missionId);

      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0].eventType, "platform.mission.created");
      assert.strictEqual(events[0].payload.missionId, mission.missionId);
      assert.strictEqual(events[1].eventType, "platform.mission.membership_granted");
    });
  });

  describe("getMission", () => {
    it("should return null for non-existent mission", () => {
      const result = repository.getMission("non-existent");
      assert.strictEqual(result, null);
    });

    it("should return mission when exists", () => {
      const created = repository.createMission(baseInput);
      const result = repository.getMission(created.missionId);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.missionId, created.missionId);
    });
  });

  describe("listMissions", () => {
    it("should return empty array for tenant with no missions", () => {
      const result = repository.listMissions("tenant-without-missions");
      assert.deepStrictEqual(result, []);
    });

    it("should return only missions for specified tenant", () => {
      repository.createMission({ ...baseInput, tenantId: "tenant-1" });
      repository.createMission({ ...baseInput, tenantId: "tenant-2", title: "Tenant 2 Mission" });

      const tenant1Missions = repository.listMissions("tenant-1");
      const tenant2Missions = repository.listMissions("tenant-2");

      assert.strictEqual(tenant1Missions.length, 1);
      assert.strictEqual(tenant2Missions.length, 1);
      assert.strictEqual(tenant1Missions[0].title, "Test Mission");
    });
  });

  describe("updateMission", () => {
    it("should throw when mission not found", () => {
      const event: AppendMissionEventInput = {
        eventType: "platform.mission.updated",
        missionId: "mis_missing",
        tenantId: "tenant-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        payload: {},
      };

      assert.throws(
        () => repository.updateMission({
          ...repository.createMission(baseInput),
          missionId: "mis_missing",
          version: 99,
        }, event),
        { message: "mission.not_found" },
      );
    });

    it("should throw when version does not advance", () => {
      const mission = repository.createMission(baseInput);
      const event: AppendMissionEventInput = {
        eventType: "platform.mission.updated",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        payload: {},
      };

      assert.throws(
        () => repository.updateMission({ ...mission, version: 0 }, event),
        { message: "mission.version_must_advance" },
      );
    });

    it("should update mission and append event", () => {
      const mission = repository.createMission(baseInput);
      const event: AppendMissionEventInput = {
        eventType: "platform.mission.status_changed",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        payload: { status: "active" },
      };

      const updated = repository.updateMission({ ...mission, status: "active", version: 1 }, event);

      assert.strictEqual(updated.status, "active");
      assert.strictEqual(updated.version, 1);

      const events = repository.listEvents(mission.missionId);
      assert.strictEqual(events.length, 3); // creation + membership + update
    });
  });

  describe("addMembership", () => {
    it("should add membership and append event", () => {
      const mission = repository.createMission(baseInput);

      const membership = repository.addMembership({
        membershipId: "mship-new",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        principalType: "user",
        principalId: "user-2",
        role: "operator",
        permissions: ["mission:read", "mission:execute"],
        deniedPermissions: [],
        status: "active",
        grantedBy: "user-1",
        grantedAt: "2026-05-01T00:00:00Z",
        expiresAt: null,
        metadata: {},
      });

      assert.strictEqual(membership.principalId, "user-2");
      assert.strictEqual(membership.role, "operator");
      assert.strictEqual(membership.version, 0);

      const events = repository.listEvents(mission.missionId);
      assert.ok(events.some((e) => e.eventType === "platform.mission.membership_granted"));
    });
  });

  describe("revokeMembership", () => {
    it("should return null when no active membership exists", () => {
      const mission = repository.createMission(baseInput);

      const result = repository.revokeMembership(
        mission.missionId,
        "user-without-membership",
        "user-1",
        "trace-1",
        "corr-1",
      );

      assert.strictEqual(result, null);
    });

    it("should revoke membership and return updated membership", () => {
      const mission = repository.createMission(baseInput);

      const result = repository.revokeMembership(
        mission.missionId,
        "user-1",
        "admin-1",
        "trace-1",
        "corr-1",
      );

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.status, "revoked");
      assert.strictEqual(result?.version, 1);
    });
  });

  describe("revokeMembershipById", () => {
    it("should return null when membership not found", () => {
      const mission = repository.createMission(baseInput);

      const result = repository.revokeMembershipById(
        mission.missionId,
        "non-existent-membership",
        "user-1",
        "trace-1",
        "corr-1",
      );

      assert.strictEqual(result, null);
    });

    it("should return null when membership belongs to different mission", () => {
      const mission1 = repository.createMission(baseInput);
      const mission2 = repository.createMission({ ...baseInput, title: "Mission 2" });

      // Get membership from mission1
      const memberships = repository.listMemberships(mission1.missionId);
      const mshipId = memberships[0].membershipId;

      // Try to revoke it for mission2
      const result = repository.revokeMembershipById(
        mission2.missionId,
        mshipId,
        "user-1",
        "trace-1",
        "corr-1",
      );

      assert.strictEqual(result, null);
    });
  });

  describe("listMemberships", () => {
    it("should return empty array for mission with no additional memberships", () => {
      const mission = repository.createMission(baseInput);
      const memberships = repository.listMemberships(mission.missionId);

      assert.strictEqual(memberships.length, 1); // owner membership
    });
  });

  describe("mission linked resources", () => {
    it("should link and list mission knowledge and learning resources", () => {
      const mission = repository.createMission(baseInput);

      repository.linkResource({
        id: "know_001",
        missionId: mission.missionId,
        tenantId: mission.tenantId,
        type: "knowledge",
        status: "published",
        title: "Runbook delta",
        ref: "kb://release/runbook-delta",
        updatedAt: "2026-05-01T00:00:00Z",
        metadata: { source: "postmortem" },
      });
      repository.linkResource({
        id: "learn_001",
        missionId: mission.missionId,
        tenantId: mission.tenantId,
        type: "learning",
        status: "pending_promotion",
        title: "Incident learning",
        ref: "learning://incident/001",
        updatedAt: "2026-05-01T00:01:00Z",
        metadata: { approval: "required" },
      });

      assert.deepStrictEqual(repository.listMissionKnowledge(mission.missionId).map((item) => item.id), ["know_001"]);
      assert.deepStrictEqual(repository.listMissionLearning(mission.missionId).map((item) => item.id), ["learn_001"]);
    });

    it("should reject linked resources for a mismatched tenant", () => {
      const mission = repository.createMission(baseInput);

      assert.throws(
        () => repository.linkResource({
          id: "know_bad",
          missionId: mission.missionId,
          tenantId: "tenant-other",
          type: "knowledge",
          status: "published",
          title: "Bad tenant",
          ref: "kb://bad",
          updatedAt: "2026-05-01T00:00:00Z",
          metadata: {},
        }),
        { message: "mission.tenant_mismatch" },
      );
    });
  });

  describe("createSnapshot", () => {
    it("should throw when mission not found", () => {
      assert.throws(
        () => repository.createSnapshot({
          missionId: "non-existent",
          taskId: "task-1",
          confirmedTaskSpecId: "spec-1",
          traceId: "trace-1",
          correlationId: "corr-1",
          createdBy: "user-1",
        }),
        { message: "mission.not_found" },
      );
    });

    it("should create snapshot with default runtime constraints", () => {
      const mission = repository.createMission(baseInput);

      const snapshot = repository.createSnapshot({
        missionId: mission.missionId,
        taskId: "task-1",
        confirmedTaskSpecId: "spec-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        createdBy: "user-1",
      });

      assert.ok(snapshot.missionSnapshotId.startsWith("msnap_"));
      assert.strictEqual(snapshot.missionId, mission.missionId);
      assert.strictEqual(snapshot.taskId, "task-1");
      assert.ok(snapshot.payloadHash);
      assert.ok(snapshot.signature === null);
    });

    it("should create linked resources for task and evidence", () => {
      const mission = repository.createMission(baseInput);

      const snapshot = repository.createSnapshot({
        missionId: mission.missionId,
        taskId: "task-1",
        confirmedTaskSpecId: "spec-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        createdBy: "user-1",
      });

      const tasks = repository.listMissionTasks(mission.missionId);
      const evidence = repository.listMissionEvidence(mission.missionId);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].type, "task");
      assert.strictEqual(evidence.length, 1);
      assert.strictEqual(evidence[0].type, "evidence");
    });

    it("should append snapshot created event", () => {
      const mission = repository.createMission(baseInput);

      repository.createSnapshot({
        missionId: mission.missionId,
        taskId: "task-1",
        confirmedTaskSpecId: "spec-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        createdBy: "user-1",
      });

      const events = repository.listEvents(mission.missionId);
      assert.ok(events.some((e) => e.eventType === "platform.mission.snapshot_created"));
    });
  });

  describe("getSnapshot", () => {
    it("should return null when snapshot not found", () => {
      const result = repository.getSnapshot("non-existent");
      assert.strictEqual(result, null);
    });
  });

  describe("appendEvent", () => {
    it("should append event with auto-generated ID and sequence", () => {
      const mission = repository.createMission(baseInput);

      const event = repository.appendEvent({
        eventType: "platform.mission.status_changed",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        traceId: "trace-2",
        correlationId: "corr-2",
        payload: { custom: "data" },
      });

      assert.ok(event.eventId.startsWith("mevt_"));
      assert.strictEqual(event.aggregateType, "mission");
      assert.strictEqual(event.aggregateId, mission.missionId);
      assert.strictEqual(event.aggregateSeq, 3); // after creation + owner membership events
    });

    it("should use provided eventId if specified", () => {
      const mission = repository.createMission(baseInput);

      const event = repository.appendEvent({
        eventType: "platform.mission.outcome_measured",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        traceId: "trace-2",
        correlationId: "corr-2",
        payload: {},
        eventId: "my-custom-event-id",
      });

      assert.strictEqual(event.eventId, "my-custom-event-id");
    });
  });

  describe("listEvents", () => {
    it("should return empty array for mission with no events beyond creation", () => {
      const mission = repository.createMission(baseInput);

      // creation + membership_granted
      const events = repository.listEvents(mission.missionId);

      assert.strictEqual(events.length, 2);
    });

    it("should return all events in order", () => {
      const mission = repository.createMission(baseInput);

      repository.appendEvent({
        eventType: "platform.mission.status_changed",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        traceId: "trace-1",
        correlationId: "corr-1",
        payload: {},
      });

      repository.appendEvent({
        eventType: "platform.mission.outcome_measured",
        missionId: mission.missionId,
        tenantId: "tenant-1",
        traceId: "trace-2",
        correlationId: "corr-2",
        payload: {},
      });

      const events = repository.listEvents(mission.missionId);

      assert.strictEqual(events.length, 4);
      assert.strictEqual(events[2].eventType, "platform.mission.status_changed");
      assert.strictEqual(events[3].eventType, "platform.mission.outcome_measured");
    });
  });

  describe("missionPrincipalFromApi", () => {
    it("should extract principalId from PrincipalRef", () => {
      const result = missionPrincipalFromApi({
        principalId: "user-123",
        principalType: "user",
      });

      assert.strictEqual(result, "user-123");
    });
  });
});

describe("SqliteMissionRepository", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let repository: SqliteMissionRepository;

  const baseInput: CreateMissionRecordInput = {
    tenantId: "tenant-1",
    title: "Persistent Mission",
    objective: "Verify sqlite mission persistence",
    successCriteria: ["mission persisted"],
    ownerPrincipalId: "user-1",
    createdBy: "creator-1",
    traceId: "trace-1",
    correlationId: "corr-1",
    metadata: { tier: "gold" },
  };

  beforeEach(() => {
    workspace = createTempWorkspace("mission-repository-");
    db = new SqliteDatabase(join(workspace, "mission.db"));
    db.migrate();
    repository = new SqliteMissionRepository(db);
  });

  afterEach(() => {
    db.close();
    cleanupPath(workspace);
  });

  function seedConfirmedTaskSpec(confirmedTaskSpecId: string, tenantId = "tenant-1", traceId = "trace-1"): void {
    db.connection.prepare(
      `INSERT INTO confirmed_task_specs (
        confirmed_task_spec_id, task_draft_id, tenant_id, goal, inputs_json,
        constraint_pack_ref, risk_class, idempotency_key, trace_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      confirmedTaskSpecId,
      "task-draft-mission-test",
      tenantId,
      "Mission repository sqlite fixture",
      "{}",
      "constraint-pack-mission-test",
      "medium",
      `idem:${confirmedTaskSpecId}`,
      traceId,
      "2026-06-05T00:00:00.000Z",
    );
  }

  it("persists missions, memberships, and events", () => {
    const mission = repository.createMission(baseInput);

    const persisted = repository.getMission(mission.missionId);
    const memberships = repository.listMemberships(mission.missionId);
    const events = repository.listEvents(mission.missionId);

    assert.notStrictEqual(persisted, null);
    assert.deepStrictEqual(persisted?.metadata, { tier: "gold" });
    assert.strictEqual(memberships.length, 1);
    assert.strictEqual(memberships[0].principalId, "user-1");
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].eventType, "platform.mission.created");
    assert.strictEqual(events[1].eventType, "platform.mission.membership_granted");
  });

  it("persists updates and preserves playbook binding metadata envelope", () => {
    const mission = repository.createMission({
      ...baseInput,
      playbookBinding: {
        playbookId: "playbook-1",
        playbookVersion: "v1",
        resolutionAuditRef: "audit://playbook-1",
        lockedAt: "2026-06-05T00:00:00.000Z",
        lockedBy: "owner-1",
        migrationPlanRefs: ["migration://001"],
      },
    });

    repository.updateMission(
      {
        ...mission,
        status: "active",
        version: 1,
        etag: `etag:${mission.missionId}:1`,
        updatedAt: "2026-06-05T00:10:00.000Z",
        updatedBy: "owner-1",
      },
      {
        eventType: "platform.mission.status_changed",
        missionId: mission.missionId,
        tenantId: mission.tenantId,
        traceId: "trace-2",
        correlationId: "corr-2",
        payload: { status: "active" },
      },
    );

    const persisted = repository.getMission(mission.missionId);
    assert.strictEqual(persisted?.status, "active");
    assert.strictEqual(persisted?.playbookBinding?.playbookId, "playbook-1");
  });

  it("persists linked resources and snapshots under real sqlite constraints", () => {
    const mission = repository.createMission(baseInput);
    seedConfirmedTaskSpec("ctspec-1");

    const snapshot = repository.createSnapshot({
      missionId: mission.missionId,
      taskId: "task-1",
      confirmedTaskSpecId: "ctspec-1",
      traceId: "trace-1",
      correlationId: "corr-1",
      createdBy: "user-1",
    });

    repository.linkResource({
      id: "know_001",
      missionId: mission.missionId,
      tenantId: mission.tenantId,
      type: "knowledge",
      status: "published",
      title: "Mission runbook",
      ref: "kb://mission/runbook",
      updatedAt: "2026-06-05T00:02:00.000Z",
      metadata: { source: "operator" },
    });

    assert.strictEqual(repository.getSnapshot(snapshot.missionSnapshotId)?.taskId, "task-1");
    assert.deepStrictEqual(repository.listMissionTasks(mission.missionId).map((item) => item.id), ["task-1"]);
    assert.deepStrictEqual(repository.listMissionEvidence(mission.missionId).map((item) => item.id), [snapshot.missionSnapshotId]);
    assert.deepStrictEqual(repository.listMissionKnowledge(mission.missionId).map((item) => item.id), ["know_001"]);
  });

  it("revokes membership by id without losing persistent state", () => {
    const mission = repository.createMission(baseInput);
    const member = repository.addMembership({
      membershipId: "mship-operator",
      missionId: mission.missionId,
      tenantId: mission.tenantId,
      principalType: "user",
      principalId: "user-2",
      role: "operator",
      permissions: ["mission:read", "mission:execute"],
      deniedPermissions: [],
      status: "active",
      grantedBy: "user-1",
      grantedAt: "2026-06-05T00:01:00.000Z",
      expiresAt: null,
      metadata: {},
    });

    const revoked = repository.revokeMembershipById(
      mission.missionId,
      member.membershipId,
      "admin-1",
      "trace-9",
      "corr-9",
    );

    assert.strictEqual(revoked?.status, "revoked");
    assert.strictEqual(repository.listMemberships(mission.missionId).find((item) => item.membershipId === member.membershipId)?.status, "revoked");
    assert.ok(repository.listEvents(mission.missionId).some((event) => event.eventType === "platform.mission.membership_revoked"));
  });
});
