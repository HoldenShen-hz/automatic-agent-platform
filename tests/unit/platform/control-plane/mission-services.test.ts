import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  buildMissionEtag,
  type MissionResolutionRequest,
} from "../../../../src/platform/contracts/mission/index.js";
import {
  createNodeRun,
  createPlanGraphBundle,
  type PlanGraph,
  type PrincipalRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { AppError } from "../../../../src/platform/contracts/errors.js";
import { InMemoryMissionRepository } from "../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import {
  MissionBudgetService,
  MissionGovernanceService,
  MissionHandoffService,
  LegacyMissionBackfillService,
  MissionHomeRegionService,
  MissionLifecycleService,
  MissionLiveGuard,
  MissionLearningPromotionGate,
  MissionObservabilityPolicy,
  MissionPlaybookRegistry,
  MissionResolver,
  MissionRuntimeBindingService,
  StageExitGateService,
  createMissionContextSnapshot,
  validateMissionPlaybook,
} from "../../../../src/platform/five-plane-control-plane/mission/index.js";

const principal: PrincipalRef = {
  principalId: "user_001",
  type: "human",
  tenantId: "tenant_001",
  roles: ["operator"],
};

function createActiveMission(repository = new InMemoryMissionRepository()) {
  const lifecycle = new MissionLifecycleService(repository);
  const created = lifecycle.createMission({
    tenantId: "tenant_001",
    orgId: "org_001",
    title: "Mission",
    objective: "Ship safely",
    successCriteria: ["done"],
    ownerPrincipalId: principal.principalId,
    domainId: "coding",
    createdBy: principal.principalId,
    traceId: "trace_001",
    correlationId: "corr_001",
    missionId: "mis_001",
  });
  return {
    repository,
    lifecycle,
    mission: lifecycle.transition({
      missionId: created.missionId,
      expectedVersion: 0,
      ifMatch: buildMissionEtag(created.missionId, 0),
      targetStatus: "active",
      actorId: principal.principalId,
      traceId: "trace_001",
      correlationId: "corr_001",
    }),
  };
}

test("MissionLifecycleService enforces CAS status transitions", () => {
  const { lifecycle, mission } = createActiveMission();

  assert.throws(
    () =>
      lifecycle.transition({
        missionId: mission.missionId,
        expectedVersion: 0,
        ifMatch: buildMissionEtag(mission.missionId, 0),
        targetStatus: "paused",
        actorId: principal.principalId,
        traceId: "trace_002",
        correlationId: "corr_002",
      }),
    (error: unknown) => error instanceof AppError && error.code === "mission.version_conflict",
  );

  const paused = lifecycle.transition({
    missionId: mission.missionId,
    expectedVersion: 1,
    ifMatch: mission.etag,
    targetStatus: "paused",
    actorId: principal.principalId,
    traceId: "trace_003",
    correlationId: "corr_003",
  });
  assert.equal(paused.status, "paused");
});

test("Mission P1/P2 support services enforce observability, learning, and region baselines", () => {
  const observability = new MissionObservabilityPolicy();
  assert.deepEqual(observability.sanitizeMetricLabels({ missionId: "mis_001", tenant: "tenant_001", mission_id: "mis_002" }), {
    tenant: "tenant_001",
  });
  assert.equal(observability.buildTraceAttributes({ missionId: "mis_001" })["mission.id"], "mis_001");

  const learning = new MissionLearningPromotionGate();
  assert.equal(learning.evaluate({ missionId: "mis_001", targetScope: "domain", evidenceRefs: [] }).allowed, false);
  assert.equal(learning.evaluate({ missionId: "mis_001", targetScope: "mission", evidenceRefs: [] }).allowed, true);

  const regions = new MissionHomeRegionService();
  assert.equal(regions.assignHomeRegion({ missionId: "mis_001", region: "us-east" }).epoch, 1);
  regions.registerReadReplica("mis_001", "us-west");
  assert.deepEqual(regions.routeRead({ missionId: "mis_001", preferredRegion: "us-west", consistency: "eventual" }), {
    missionId: "mis_001",
    region: "us-west",
    source: "read_replica",
    consistency: "eventual",
  });
  assert.equal(regions.routeRead({ missionId: "mis_001", preferredRegion: "us-west", consistency: "strong" }).region, "us-east");
  assert.equal(regions.assignHomeRegion({ missionId: "mis_001", region: "us-west" }).epoch, 2);
  assert.throws(() => regions.assertWriteEpoch("mis_001", 1));
});

test("LegacyMissionBackfillService batch backfills Task and Session mission refs with unresolved accounting", () => {
  const service = new LegacyMissionBackfillService();
  const missionRef = {
    missionId: "mis_001",
    missionSnapshotId: "msnap_001",
    missionVersion: 1,
    boundAt: "2026-05-21T00:00:00.000Z",
    boundBy: principal.principalId,
  };
  const result = service.backfillBatch({
    tasks: [{ id: "task_missing" }, { id: "task_existing", missionRef }],
    sessions: [{ id: "session_missing" }, { id: "session_unresolved" }],
    resolveMissionRef(record) {
      return record.id === "session_unresolved" ? null : missionRef;
    },
  });

  assert.equal(result.tasks[0]?.missionRef, missionRef);
  assert.equal(result.sessions[0]?.missionRef, missionRef);
  assert.equal(result.report.taskBackfilled, 1);
  assert.equal(result.report.sessionBackfilled, 1);
  assert.equal(result.report.unresolvedCount, 1);
});

test("MissionHandoffService requires trusted tenant pair for federated handoff", () => {
  const source = createActiveMission().mission;
  const targetRepo = new InMemoryMissionRepository();
  const lifecycle = new MissionLifecycleService(targetRepo);
  const target = lifecycle.createMission({
    missionId: "mis_target",
    tenantId: "tenant_002",
    orgId: "org_002",
    title: "Target Mission",
    objective: "Receive handoff",
    successCriteria: ["handoff accepted"],
    ownerPrincipalId: "user_002",
    domainId: "coding",
    createdBy: "user_002",
    traceId: "trace_target",
    correlationId: "corr_target",
  });
  const service = new MissionHandoffService();
  const input = {
    sourceMission: source,
    targetMission: target,
    requestedBy: principal.principalId,
    approvalRef: "approval:handoff",
    auditRef: "audit:handoff",
    reason: "Delegate to partner tenant",
  };

  assert.throws(() => service.requestFederated(input));
  service.trustTenantPair(source.tenantId, target.tenantId);
  assert.equal(service.requestFederated(input).targetMissionId, target.missionId);
});

test("MissionResolver handles explicit, ad hoc, and high-risk fail-closed paths", () => {
  const { repository, mission } = createActiveMission();
  const resolver = new MissionResolver(repository, new MissionGovernanceService(repository));
  const base: MissionResolutionRequest = {
    tenantId: "tenant_001",
    confirmedTaskSpecId: "ctspec_001",
    principal,
    goal: "Do coding task",
    domainId: "coding",
    riskClass: "low",
    traceId: "trace_001",
    correlationId: "corr_001",
  };

  assert.equal(resolver.resolve({ ...base, missionRef: { mode: "use_existing", missionId: mission.missionId } }).resolution, "matched_existing");
  assert.equal(resolver.resolve({ ...base, confirmedTaskSpecId: "ctspec_002", missionRef: { mode: "auto_resolve", allowAdHoc: true, createFormalMissionWhen: "never" } }).resolution, "created_ad_hoc");
  assert.equal(resolver.resolve({ ...base, confirmedTaskSpecId: "ctspec_003", riskClass: "high" }).resolution, "rejected");
});

test("Mission repository sequences events monotonically", () => {
  const { repository, mission } = createActiveMission();
  repository.appendEvent({
    eventType: "platform.mission.bound_to_task",
    missionId: mission.missionId,
    tenantId: mission.tenantId,
    traceId: "trace_004",
    correlationId: "corr_004",
    payload: { taskId: "task_001" },
  });

  assert.deepEqual(repository.listEvents(mission.missionId).map((event) => event.aggregateSeq), [1, 2, 3, 4]);
});

test("MissionLiveGuard blocks after membership revocation and freeze", () => {
  const { repository, lifecycle, mission } = createActiveMission();
  const snapshot = createMissionContextSnapshot(repository, {
    missionId: mission.missionId,
    taskId: "task_001",
    confirmedTaskSpecId: "ctspec_001",
    principal,
    traceId: "trace_001",
    correlationId: "corr_001",
    runtimeConstraints: DEFAULT_RUNTIME_CONSTRAINT_SET,
  });
  const guard = new MissionLiveGuard(repository);

  assert.equal(guard.evaluate({ missionSnapshotId: snapshot.missionSnapshotId, principal }).allowed, true);

  repository.revokeMembership(mission.missionId, principal.principalId, principal.principalId, "trace_revoke", "corr_revoke");
  assert.equal(guard.evaluate({ missionSnapshotId: snapshot.missionSnapshotId, principal }).reasonCode, "mission.membership_revoked");

  lifecycle.transition({
    missionId: mission.missionId,
    expectedVersion: 1,
    ifMatch: mission.etag,
    targetStatus: "frozen",
    actorId: principal.principalId,
    traceId: "trace_freeze",
    correlationId: "corr_freeze",
  });
  assert.equal(guard.evaluate({ missionSnapshotId: snapshot.missionSnapshotId, principal }).reasonCode, "mission.not_executable");
});

test("MissionBudgetService prevents concurrent over-reservation baseline", () => {
  const budget = new MissionBudgetService();
  budget.register({
    budgetEnvelopeId: "budget_001",
    missionId: "mis_001",
    currency: "USD",
    hardCap: 10,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    version: 0,
  });

  assert.equal(budget.reserve("mis_001", 8).reservedAmount, 8);
  assert.throws(() => budget.reserve("mis_001", 3));
});

test("MissionRuntimeBindingService binds PlanGraphBundle, HarnessRun, and NodeRun to one snapshot", () => {
  const { repository, mission } = createActiveMission();
  const snapshot = createMissionContextSnapshot(repository, {
    missionId: mission.missionId,
    taskId: "task_001",
    confirmedTaskSpecId: "ctspec_001",
    principal,
    traceId: "trace_001",
    correlationId: "corr_001",
  });
  const graph: PlanGraph = {
    graphId: "graph_001",
    nodes: [{
      nodeId: "node_001",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema_001",
      riskClass: "low",
      budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["tool"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry_001",
      timeoutMs: 1000,
    }],
    edges: [],
    entryNodeIds: ["node_001"],
    terminalNodeIds: ["node_001"],
    joinStrategy: "all",
    graphHash: "hash_001",
  };
  const bundle = createPlanGraphBundle({
    harnessRunId: "hrun_001",
    graph,
    schedulerPolicy: { policyId: "fifo", strategy: "deterministic_fifo" },
    budgetPlanRef: "budget_plan_001",
    riskProfile: { riskClass: "low", reasons: [] },
  });
  const nodeRun = createNodeRun({
    harnessRunId: "hrun_001",
    planGraphBundleId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    nodeId: "node_001",
  });

  assert.equal(MissionRuntimeBindingService.bindPlanGraphBundle(bundle, snapshot).missionSnapshotRef, snapshot.missionSnapshotId);
  assert.equal(MissionRuntimeBindingService.bindNodeRun(nodeRun, snapshot).missionSnapshotRef, snapshot.missionSnapshotId);
  assert.equal(MissionRuntimeBindingService.bindHarnessRun({ harnessRun: {}, snapshot, actorId: principal.principalId }).missionId, mission.missionId);
  assert.throws(() =>
    MissionRuntimeBindingService.bindHarnessRun({
      harnessRun: {
        missionBinding: {
          missionId: "mis_other",
          missionSnapshotId: "msnap_other",
          missionVersion: 0,
          boundAt: "2026-05-13T00:00:00.000Z",
          boundBy: principal.principalId,
        },
      },
      snapshot,
      actorId: principal.principalId,
    }),
  );
});

function createResearchPlaybook() {
  return {
    playbookId: "playbook_research_release",
    version: "1.0.0",
    missionType: "formal" as const,
    title: "Research release",
    owner: "mission-ops",
    status: "active" as const,
    entryStageId: "review",
    stages: [{
      stageId: "review",
      title: "Review",
      exitCriteria: [
        {
          criterionId: "review.evidence",
          name: "Claims have evidence",
          severity: "P0" as const,
          gateId: "GATE-EVIDENCE-001",
          expression: { type: "evidence_exists" as const, evidenceKind: "claim_evidence", minCount: 1 },
          requiredEvidenceRefs: ["snapshot:evidence"],
          requiredMetricRefs: [],
        },
        {
          criterionId: "review.quality",
          name: "Quality accepted",
          severity: "P1" as const,
          gateId: "GATE-MISSION-OUTCOME-001",
          expression: {
            type: "metric_threshold" as const,
            metric: "aa.mission.outcome.quality_score",
            operator: ">=" as const,
            value: 0.85,
          },
          requiredEvidenceRefs: [],
          requiredMetricRefs: ["aa.mission.outcome.quality_score"],
        },
      ],
      failureModeRefs: ["failure:unsupported_claim"],
      defaultSkillRefs: ["skill:research-review"],
      evidenceRequirements: ["claim_evidence"],
    }, {
      stageId: "publish",
      title: "Publish",
      exitCriteria: [{
        criterionId: "publish.outcome",
        name: "Outcome report exists",
        severity: "P1" as const,
        gateId: "GATE-MISSION-OUTCOME-001",
        expression: { type: "evidence_exists" as const, evidenceKind: "outcome_report", minCount: 1 },
        requiredEvidenceRefs: ["snapshot:outcome"],
        requiredMetricRefs: [],
      }],
      failureModeRefs: ["failure:missing_outcome"],
      defaultSkillRefs: [],
      evidenceRequirements: ["outcome_report"],
    }],
    edges: [{
      edgeId: "review_to_publish",
      fromStageId: "review",
      toStageId: "publish",
      requiredGateIds: ["GATE-EVIDENCE-001", "GATE-MISSION-OUTCOME-001"],
      requiresHitl: true,
      requiredCapabilities: ["mission.publish"],
    }],
    signatureRef: "sig:research-release",
    rollbackRef: "rollback:research-release",
    compatibilityRef: "compat:research-release",
    createdAt: "2026-05-21T00:00:00.000Z",
    updatedAt: "2026-05-21T00:00:00.000Z",
  };
}

test("MissionPlaybookRegistry validates registry references and rejects unsafe P0 negation", () => {
  const playbook = createResearchPlaybook();
  const validation = validateMissionPlaybook(playbook, {
    metricRefs: ["aa.mission.outcome.quality_score"],
    evidenceKinds: ["claim_evidence", "outcome_report"],
  });
  assert.equal(validation.valid, true);

  const unsafe = validateMissionPlaybook({
    ...playbook,
    stages: [{
      ...playbook.stages[0]!,
      exitCriteria: [{
        ...playbook.stages[0]!.exitCriteria[0]!,
        expression: { type: "not", criterion: { type: "event_count", eventName: "mission.review.failed", operator: ">", value: 0 } },
      }],
    }, playbook.stages[1]!],
  }, {
    eventNames: ["mission.review.failed"],
    evidenceKinds: ["claim_evidence", "outcome_report"],
  });

  assert.equal(unsafe.valid, false);
  assert.equal(unsafe.issues.some((issue) => issue.code === "mission.playbook.p0_unsafe_negation"), true);
});

test("StageExitGateService evaluates immutable snapshots, requires HITL for guarded edge, and appends evidence event", () => {
  const { repository, mission } = createActiveMission();
  const registry = new MissionPlaybookRegistry({
    metricRefs: ["aa.mission.outcome.quality_score"],
    evidenceKinds: ["claim_evidence", "outcome_report"],
  });
  const playbook = registry.register(createResearchPlaybook());
  const service = new StageExitGateService(registry, repository);
  const stageInstance = {
    stageInstanceId: "mstage_review_001",
    missionId: mission.missionId,
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    stageId: "review",
    cycleIndex: 0,
    status: "active" as const,
    version: 0,
    enteredAt: "2026-05-21T00:00:00.000Z",
  };
  const held = service.evaluate({
    mission,
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    stageInstance,
    snapshot: {
      metricValues: { "aa.mission.outcome.quality_score": 0.92 },
      eventCounts: {},
      evidenceCounts: {},
      hitlDecisions: {},
      snapshotRefs: ["snapshot:review:held"],
    },
    actorId: principal.principalId,
    traceId: "trace_stage_held",
    correlationId: "corr_stage_held",
    evaluatedAt: "2026-05-21T00:01:00.000Z",
  });
  assert.equal(held.decision, "hold");
  assert.deepEqual(held.failedCriterionIds, ["review.evidence"]);

  const approvalRequired = service.evaluate({
    mission,
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    stageInstance,
    snapshot: {
      metricValues: { "aa.mission.outcome.quality_score": 0.92 },
      eventCounts: {},
      evidenceCounts: { claim_evidence: 2 },
      hitlDecisions: {},
      snapshotRefs: ["snapshot:review:ready"],
    },
    actorId: principal.principalId,
    traceId: "trace_stage_hitl",
    correlationId: "corr_stage_hitl",
    evaluatedAt: "2026-05-21T00:02:00.000Z",
  });
  assert.equal(approvalRequired.decision, "require_hitl");
  assert.deepEqual(approvalRequired.requiredActions, ["approve_stage_edge:review_to_publish"]);

  const advanced = service.evaluate({
    mission,
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    stageInstance,
    snapshot: {
      metricValues: { "aa.mission.outcome.quality_score": 0.92 },
      eventCounts: {},
      evidenceCounts: { claim_evidence: 2 },
      hitlDecisions: { "stage_edge:review_to_publish": "approved" },
      snapshotRefs: ["snapshot:review:approved"],
    },
    actorId: principal.principalId,
    traceId: "trace_stage_advance",
    correlationId: "corr_stage_advance",
    evaluatedAt: "2026-05-21T00:03:00.000Z",
  });

  assert.equal(advanced.decision, "advance");
  assert.equal(advanced.targetStageId, "publish");
  assert.equal(repository.listEvents(mission.missionId).at(-1)?.eventType, "platform.mission.stage_exit_evaluated");
});
