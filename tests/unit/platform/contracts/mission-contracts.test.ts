import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_RUNTIME_CONSTRAINT_SET,
  ExitCriterionExpressionSchema,
  MissionErrorEnvelopeSchema,
  MissionPlaybookMigrationPlanSchema,
  MissionPlaybookResolutionPolicySchema,
  MissionPlaybookResolutionResultSchema,
  MissionOperatingModelRegistryPatchSchema,
  MissionPlaybookSchema,
  MissionRecordSchema,
  MissionStageInstanceSchema,
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
    playbookBinding: {
      playbookId: "mission-playbook-research",
      playbookVersion: "1.0.0",
      resolutionAuditRef: "audit:resolution:001",
      lockedAt: "2026-05-13T00:00:00.000Z",
      lockedBy: "user_001",
      migrationPlanRefs: [],
    },
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
      code: "mission.required",
      message: "Mission required",
      requestId: "req_001",
      traceId: "trace_001",
    }),
  );
});

test("Mission playbook contracts keep stage governance separate from runtime nodes", () => {
  const playbook = MissionPlaybookSchema.parse({
    playbookId: "playbook_research",
    version: "1.0.0",
    missionType: "formal",
    title: "Research release",
    owner: "mission-ops",
    status: "active",
    entryStageId: "review",
    stages: [{
      stageId: "review",
      title: "Review",
      exitCriteria: [{
        criterionId: "review.evidence",
        name: "Evidence exists",
        severity: "P0",
        gateId: "GATE-EVIDENCE-001",
        expression: { type: "evidence_exists", evidenceKind: "claim_evidence" },
        requiredEvidenceRefs: ["evidence:snapshot"],
        requiredMetricRefs: [],
      }],
      failureModeRefs: ["failure:unsupported_claim"],
      defaultSkillRefs: [],
      evidenceRequirements: ["claim_evidence"],
    }],
    edges: [],
    compatibility: {
      minPlatformVersion: "2.0.0",
      compatibleMissionSchemaVersions: ["1.x"],
    },
    rollout: {
      mode: "full",
      percentage: 100,
      targetTenants: [],
      rolloutRef: "rollout:research",
    },
    signature: {
      signedBy: "platform-architecture",
      signatureRef: "sig:research",
      signedAt: "2026-05-21T00:00:00.000Z",
    },
    rollback: {
      previousVersion: null,
      rollbackAllowed: true,
      rollbackRef: "rollback:research",
    },
    signatureRef: "sig:research",
    rollbackRef: "rollback:research",
    compatibilityRef: "compat:research",
    createdAt: "2026-05-21T00:00:00.000Z",
    updatedAt: "2026-05-21T00:00:00.000Z",
  });
  const stage = MissionStageInstanceSchema.parse({
    stageInstanceId: "mstage_001",
    missionId: "mis_001",
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    stageId: "review",
    cycleIndex: 0,
    status: "active",
    version: 0,
    enteredAt: "2026-05-21T00:00:00.000Z",
  });

  assert.equal(playbook.stages[0]?.stageId, "review");
  assert.equal(stage.stageId, "review");
  assert.equal("nodeId" in stage, false);
  assert.throws(() =>
    ExitCriterionExpressionSchema.parse({
      type: "metric_threshold",
      metric: "aa.mission.outcome.quality_score",
      operator: ">=",
      value: 0.8,
      window: { type: "stage", stageInstanceId: "mstage_001" },
    }),
  );
});

test("Mission playbook resolution and migration contracts stay machine parseable", () => {
  const policy = MissionPlaybookResolutionPolicySchema.parse({
    missionType: "formal",
    tenantId: "tenant_001",
    requestedPlaybookId: "mission-playbook-research",
    requestedVersion: "1.0.0",
    allowCanary: false,
    tenantOverrideAllowed: true,
    fallbackPolicy: "use_last_active",
  });
  const resolution = MissionPlaybookResolutionResultSchema.parse({
    playbookId: "mission-playbook-research",
    playbookVersion: "1.0.0",
    resolutionReason: "last_active_fallback",
    auditRef: "audit:resolution:001",
  });
  const migration = MissionPlaybookMigrationPlanSchema.parse({
    migrationPlanId: "mpbmig_001",
    fromPlaybookId: "mission-playbook-research",
    fromVersion: "1.0.0",
    toPlaybookId: "mission-playbook-research",
    toVersion: "1.1.0",
    affectedMissionIds: ["mis_001"],
    migrationMode: "hold_then_manual",
    compatibilityReportRef: "compatibility:report:001",
    approvalRef: "approval:001",
    rollbackPlanRef: "rollback:plan:001",
    auditRef: "audit:migration:001",
    createdAt: "2026-05-21T00:00:00.000Z",
  });

  assert.equal(policy.fallbackPolicy, "use_last_active");
  assert.equal(resolution.resolutionReason, "last_active_fallback");
  assert.equal(migration.migrationMode, "hold_then_manual");
});

test("Mission operating model validation registry patch stays machine parseable", () => {
  const patch = MissionOperatingModelRegistryPatchSchema.parse(JSON.parse(readFileSync(
    new URL("../../../../config/validation/mission-operating-model-registry.json", import.meta.url),
    "utf8",
  )));
  const metricAlertPolicy = JSON.parse(readFileSync(
    new URL("../../../../config/validation/mission-operating-model-metric-alert-policy.yaml", import.meta.url),
    "utf8",
  ));

  assert.equal(patch.ciJobs.some((job) => job.jobId === "playbook-validate"), true);
  assert.equal(patch.gates.some((gate) => gate.gateId === "GATE-WORKFLOW-RECORDING-003"), true);
  assert.equal(patch.events.includes("platform.mission.outcome_measured"), true);
  assert.equal(metricAlertPolicy.metrics.some((entry: { metric: string }) => entry.metric === "aa.mission.playbook.use_last_active.count"), true);
});
