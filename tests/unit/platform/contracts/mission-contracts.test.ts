import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  MissionErrorEnvelopeSchema,
  MissionRecordSchema,
  RuntimeConstraintSetSchema,
  buildMissionEtag,
  computeMissionSnapshotHash,
  mergeRuntimeConstraintSets,
  nextMissionStatus,
} from "../../../../src/platform/contracts/mission/index.js";

test("MissionRecord schema is strict and requires canonical fields", () => {
  const record = {
    missionId: "mis_001",
    tenantId: "tenant_001",
    orgId: "org_001",
    type: "formal",
    status: "draft",
    priority: "normal",
    title: "Product launch",
    description: null,
    objective: "Launch the product safely",
    successCriteria: ["release approved"],
    ownerPrincipalId: "user_001",
    accountablePrincipalId: null,
    domainId: "coding",
    policyRefs: [],
    riskProfileRef: null,
    budgetEnvelopeRef: null,
    knowledgeBoundaryRef: null,
    defaultWorkflowTemplateRefs: [],
    metadata: {},
    freezeReason: null,
    createdAt: "2026-05-13T00:00:00.000Z",
    createdBy: "user_001",
    updatedAt: "2026-05-13T00:00:00.000Z",
    updatedBy: "user_001",
    archivedAt: null,
    archivedBy: null,
    version: 0,
    etag: buildMissionEtag("mis_001", 0),
  };

  assert.equal(MissionRecordSchema.parse(record).missionId, "mis_001");
  assert.throws(() => MissionRecordSchema.parse({ ...record, extra: true }));
  assert.throws(() => MissionRecordSchema.parse({ ...record, objective: "" }));
});

test("Mission status transition table rejects illegal transitions", () => {
  assert.equal(nextMissionStatus("draft", "active"), true);
  assert.equal(nextMissionStatus("active", "paused"), true);
  assert.equal(nextMissionStatus("active", "archived"), false);
  assert.equal(nextMissionStatus("archived", "active"), false);
});

test("MissionSnapshot hash is reproducible", () => {
  const base = {
    missionSnapshotId: "msnap_001",
    missionId: "mis_001",
    missionVersion: 0,
    tenantId: "tenant_001",
    orgId: "org_001",
    taskId: "task_001",
    confirmedTaskSpecId: "ctspec_001",
    runtimeConstraints: DEFAULT_RUNTIME_CONSTRAINT_SET,
    mission: MissionRecordSchema.parse({
      missionId: "mis_001",
      tenantId: "tenant_001",
      orgId: "org_001",
      type: "formal",
      status: "active",
      priority: "normal",
      title: "Mission",
      description: null,
      objective: "Objective",
      successCriteria: ["done"],
      ownerPrincipalId: "user_001",
      accountablePrincipalId: null,
      domainId: null,
      policyRefs: [],
      riskProfileRef: null,
      budgetEnvelopeRef: null,
      knowledgeBoundaryRef: null,
      defaultWorkflowTemplateRefs: [],
      metadata: {},
      freezeReason: null,
      createdAt: "2026-05-13T00:00:00.000Z",
      createdBy: "user_001",
      updatedAt: "2026-05-13T00:00:00.000Z",
      updatedBy: "user_001",
      archivedAt: null,
      archivedBy: null,
      version: 0,
      etag: buildMissionEtag("mis_001", 0),
    }),
    memberships: [],
    signature: null,
    traceId: "trace_001",
    correlationId: "corr_001",
    createdAt: "2026-05-13T00:00:00.000Z",
    createdBy: "user_001",
  };

  assert.equal(computeMissionSnapshotHash(base), computeMissionSnapshotHash({ ...base, memberships: [] }));
});

test("RuntimeConstraintSet merge uses constraint intersection semantics", () => {
  const merged = mergeRuntimeConstraintSets(
    { ...DEFAULT_RUNTIME_CONSTRAINT_SET, allowAutoExecute: true, maxParallelNodeRuns: 8, dataResidency: ["us", "eu"] },
    { allowAutoExecute: false, maxParallelNodeRuns: 3, dataResidency: ["us"] },
  );

  assert.equal(RuntimeConstraintSetSchema.parse(merged).allowAutoExecute, false);
  assert.equal(merged.maxParallelNodeRuns, 3);
  assert.deepEqual(merged.dataResidency, ["us"]);
});

test("MissionErrorEnvelope requires trace and correlation identifiers", () => {
  assert.throws(() =>
    MissionErrorEnvelopeSchema.parse({
      code: "MISSION_REQUIRED",
      message: "Mission required",
      requestId: "req_001",
      traceId: "trace_001",
    }),
  );
});
