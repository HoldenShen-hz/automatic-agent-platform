import assert from "node:assert/strict";
import test from "node:test";

import { buildMissionEtag } from "../../../../src/platform/contracts/mission/index.js";
import { InMemoryMissionRepository } from "../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import {
  MissionFailureModeRegistry,
  MissionLifecycleService,
  MissionOutcomeMeasurementService,
  MissionPlaybookRegistry,
  SkillCandidatePipeline,
  WorkflowRecordingService,
  createBuiltinMissionPlaybooks,
} from "../../../../src/platform/five-plane-control-plane/mission/index.js";

function createActiveFormalMission() {
  const repository = new InMemoryMissionRepository();
  const lifecycle = new MissionLifecycleService(repository);
  const created = lifecycle.createMission({
    tenantId: "tenant_001",
    orgId: "org_001",
    title: "Mission operating model",
    objective: "Close playbook loops",
    successCriteria: ["evidence recorded"],
    ownerPrincipalId: "user_001",
    domainId: "coding",
    createdBy: "user_001",
    traceId: "trace_create",
    correlationId: "corr_create",
    missionId: "mis_operating_model",
  });
  return {
    repository,
    mission: lifecycle.transition({
      missionId: created.missionId,
      expectedVersion: created.version,
      ifMatch: buildMissionEtag(created.missionId, created.version),
      targetStatus: "active",
      actorId: "user_001",
      traceId: "trace_active",
      correlationId: "corr_active",
    }),
  };
}

test("MissionFailureModeRegistry detects, dedupes, suppresses, and appends evidence events", () => {
  const { repository, mission } = createActiveFormalMission();
  const registry = new MissionFailureModeRegistry(repository);
  registry.register({
    failureModeId: "failure:unsupported_claim",
    missionProfile: "formal",
    stageId: "review",
    name: "Unsupported claim",
    severity: "P0",
    description: "Claim evidence is missing",
    triggerCondition: { type: "evidence_exists", evidenceKind: "unsupported_claim", minCount: 1 },
    linkedGateIds: ["GATE-MISSION-PLAYBOOK-001"],
    linkedRunbookIds: ["D.35"],
    defaultAction: "block",
    dedupeKeyTemplate: "{missionId}:{stageInstanceId}:{failureModeId}",
    minSampleSize: 1,
    suppressionRequiresApproval: true,
    falsePositiveReviewRequired: true,
    learningAction: "create_eval",
  });
  const input = {
    mission,
    stageInstance: {
      stageInstanceId: "mstage_review",
      missionId: mission.missionId,
      playbookId: "playbook_research",
      playbookVersion: "1.0.0",
      stageId: "review",
      cycleIndex: 0,
      status: "active" as const,
      version: 0,
      enteredAt: "2026-05-21T00:00:00.000Z",
    },
    snapshot: {
      metricValues: {},
      eventCounts: {},
      evidenceCounts: { unsupported_claim: 1 },
      hitlDecisions: {},
      snapshotRefs: ["snapshot:review"],
    },
    evidenceRefs: ["evidence:claim"],
    traceId: "trace_detect",
    correlationId: "corr_detect",
    detectedAt: "2026-05-21T00:01:00.000Z",
  };

  const detections = registry.detect(input);
  assert.equal(detections.length, 1);
  assert.equal(detections[0]?.action, "block");
  assert.equal(registry.detect(input).length, 0);
  assert.throws(() =>
    registry.suppress({
      failureModeId: "failure:unsupported_claim",
      dedupeKey: detections[0]!.dedupeKey,
      owner: "reliability-owner",
      auditRef: "audit:suppress",
      approvalRef: null,
      expiresAt: "2026-05-22T00:00:00.000Z",
    }),
  );
  assert.equal(repository.listEvents(mission.missionId).at(-1)?.eventType, "platform.mission.failure_mode_detected");
});

test("MissionOutcomeMeasurementService keeps scores sourced and emits outcome event", () => {
  const { repository, mission } = createActiveFormalMission();
  const report = new MissionOutcomeMeasurementService(repository).measure({
    missionId: mission.missionId,
    missionProfile: "formal",
    measurementWindow: "7d",
    reviewerRefs: ["reviewer:quality"],
    scores: {
      executionScore: 0.9,
      qualityScore: 0.94,
      evidenceScore: 1,
      adoptionScore: 0.6,
    },
    observations: [{
      observationId: "obs_adoption",
      outcomeType: "human_adoption",
      source: "manual_review",
      confidence: 0.8,
      observedAt: "2026-05-21T00:02:00.000Z",
      evidenceRefs: ["evidence:adoption"],
      reviewerRefs: ["reviewer:quality"],
    }],
    evidenceRefs: ["evidence:outcome"],
    scoresGeneratedFromRefs: ["scorecard:quality"],
    completion: { completed: true, terminalStatus: "completed", stageCompletionRatio: 1 },
    cost: { totalUsd: 4, costPerAcceptedOutput: 2 },
    tenantId: mission.tenantId,
    traceId: "trace_outcome",
    correlationId: "corr_outcome",
    generatedAt: "2026-05-21T00:03:00.000Z",
  });

  assert.equal(report.observations[0]?.outcomeType, "human_adoption");
  assert.equal(repository.listEvents(mission.missionId).at(-1)?.eventType, "platform.mission.outcome_measured");
});

test("WorkflowRecordingService and SkillCandidatePipeline enforce consent, retention, and activation gates", () => {
  const recorder = new WorkflowRecordingService();
  recorder.registerPolicy({
    policyId: "workflow:redacted",
    captureMode: "redacted_summary",
    allowedSurfaces: ["browser-extension"],
    allowedDataClasses: ["internal", "restricted"],
    requireConsentForRestricted: true,
    requireRedactionForRestricted: true,
    retentionMs: 1000,
    owner: "security-owner",
  });
  assert.throws(() =>
    recorder.complete({
      tenantId: "tenant_001",
      surface: "browser-extension",
      policyId: "workflow:redacted",
      dataClass: "restricted",
      summary: "Unsafe restricted recording",
      stepSummaries: [],
      toolRefs: [],
      createdAt: "2026-05-21T00:00:00.000Z",
    }),
  );
  const trace = recorder.complete({
    tenantId: "tenant_001",
    surface: "browser-extension",
    policyId: "workflow:redacted",
    dataClass: "restricted",
    consentRef: "consent:001",
    redactionReportRef: "redaction:001",
    summary: "Redacted recurring workflow",
    stepSummaries: ["Collect evidence", "Propose action"],
    toolRefs: ["tool:browser"],
    createdAt: "2026-05-21T00:00:00.000Z",
  });
  const pipeline = new SkillCandidatePipeline();
  const candidate = pipeline.createCandidate({
    trace,
    proposedSkillId: "skill:workflow-review",
    owner: "skill-owner",
    policyDraftRef: "policy:draft",
    evalSuiteRef: "eval:suite",
    rollbackStrategyRef: "rollback:skill",
    requiredPermissions: ["browser:read"],
  });

  assert.throws(() =>
    pipeline.convertToSkillPack({
      candidateId: candidate.candidateId,
      version: "1.0.0",
      manifestValidationRef: "manifest:ok",
      policyValidationRef: "policy:ok",
      sbomScanRef: "sbom:ok",
      evalReportRef: "eval:ok",
      signatureRef: "sig:ok",
      canaryEvidenceRef: "canary:ok",
      rollbackRef: "rollback:ok",
    }),
  );
  pipeline.requestReview(candidate.candidateId);
  pipeline.approve(candidate.candidateId, "hitl:approved");
  const pack = pipeline.convertToSkillPack({
    candidateId: candidate.candidateId,
    version: "1.0.0",
    manifestValidationRef: "manifest:ok",
    policyValidationRef: "policy:ok",
    sbomScanRef: "sbom:ok",
    evalReportRef: "eval:ok",
    signatureRef: "sig:ok",
    canaryEvidenceRef: "canary:ok",
    rollbackRef: "rollback:ok",
  });
  assert.equal(pack.status, "active");

  const retention = recorder.sweepRetention({
    sweptAt: "2026-05-21T00:01:00.000Z",
    deletionProofFor: () => "deletion:proof",
  });
  assert.equal(retention[0]?.status, "deleted");
  assert.equal(recorder.get(trace.traceId), null);
});

test("builtin Research Code and Ops playbooks are active and validate with registry catalogs", () => {
  const registry = new MissionPlaybookRegistry({
    evidenceKinds: [
      "research_brief",
      "claim_evidence",
      "plan_bundle",
      "test_report",
      "incident_snapshot",
      "rollback_or_fix_evidence",
    ],
  });
  const playbooks = createBuiltinMissionPlaybooks();

  assert.deepEqual(playbooks.map((playbook) => playbook.missionType), ["formal", "program", "incident"]);
  for (const playbook of playbooks) {
    assert.equal(registry.register(playbook).status, "active");
  }
  assert.equal(registry.resolveActive("incident")?.playbookId, "mission-playbook-ops");
});
