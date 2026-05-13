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
import { InMemoryMissionRepository } from "../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import {
  MissionBudgetService,
  MissionGovernanceService,
  MissionHomeRegionService,
  MissionLifecycleService,
  MissionLiveGuard,
  MissionLearningPromotionGate,
  MissionObservabilityPolicy,
  MissionResolver,
  MissionRuntimeBindingService,
  createMissionContextSnapshot,
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

  assert.throws(() =>
    lifecycle.transition({
      missionId: mission.missionId,
      expectedVersion: 0,
      ifMatch: buildMissionEtag(mission.missionId, 0),
      targetStatus: "paused",
      actorId: principal.principalId,
      traceId: "trace_002",
      correlationId: "corr_002",
    }),
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
  assert.equal(regions.assignHomeRegion({ missionId: "mis_001", region: "us-west" }).epoch, 2);
  assert.throws(() => regions.assertWriteEpoch("mis_001", 1));
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
