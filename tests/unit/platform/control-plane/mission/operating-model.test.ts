/**
 * Unit tests for Mission Operating Model
 * Tests failure mode registry, workflow recording, skill candidate pipeline,
 * and builtin playbooks
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  MissionFailureModeRegistry,
  MissionOutcomeMeasurementService,
  WorkflowRecordingService,
  SkillCandidatePipeline,
  createBuiltinMissionPlaybooks,
  type MissionFailureMode,
  type MissionFailureModeDetectionInput,
  type MissionFailureModeSuppression,
  type MissionOutcomeReport,
  type WorkflowRecordingInput,
  type WorkflowTrace,
  type MissionPlaybook,
} from "../../../../../src/platform/five-plane-control-plane/mission/operating-model.js";
import { AppError } from "../../../../../src/platform/contracts/errors.js";

// Helper to create minimal test data
function createTestMissionRecord(overrides: Partial<{
  missionId: string;
  missionType: string;
  tenantId: string;
}> = {}): { missionId: string; missionType: string; tenantId: string } {
  return {
    missionId: overrides.missionId ?? "mission-test-001",
    missionType: overrides.missionType ?? "formal",
    tenantId: overrides.tenantId ?? "tenant-test",
  };
}

function createTestStageInstance(overrides: Partial<{
  stageInstanceId: string;
  stageId: string;
}> = {}): { stageInstanceId: string; stageId: string } {
  return {
    stageInstanceId: overrides.stageInstanceId ?? "stage-inst-001",
    stageId: overrides.stageId ?? "design",
  };
}

function createTestSnapshot(): { metricValues: Record<string, number>; eventCounts: Record<string, number>; evidenceCounts: Record<string, number>; hitlDecisions: Record<string, string> } {
  return {
    metricValues: { execution_time_ms: 1000 },
    eventCounts: { "task:completed": 5 },
    evidenceCounts: { "design_doc": 2 },
    hitlDecisions: {},
  };
}

// ============================================
// MissionFailureModeRegistry Tests
// ============================================

test("MissionFailureModeRegistry registers failure mode", () => {
  const registry = new MissionFailureModeRegistry();

  const mode: MissionFailureMode = {
    failureModeId: "fm-001",
    severity: "P1",
    missionProfile: "formal",
    stageId: "design",
    triggerCondition: {
      type: "metric_threshold",
      metric: "error_rate",
      operator: ">=",
      value: 0.05,
    },
    defaultAction: "alert",
    linkedGateIds: [],
    linkedRunbookIds: ["rb-001"],
    dedupeKeyTemplate: "{missionId}:{stageId}",
    minSampleSize: 10,
  };

  const registered = registry.register(mode);
  assert.equal(registered.failureModeId, "fm-001");
  assert.equal(registry.list().length, 1);
});

test("MissionFailureModeRegistry rejects P0 without gate or runbook", () => {
  const registry = new MissionFailureModeRegistry();

  const p0Mode: MissionFailureMode = {
    failureModeId: "fm-p0-001",
    severity: "P0",
    missionProfile: "*",
    stageId: "deploy",
    triggerCondition: {
      type: "metric_threshold",
      metric: "error_rate",
      operator: ">=",
      value: 0.1,
    },
    defaultAction: "halt",
    linkedGateIds: [], // Empty - should fail
    linkedRunbookIds: [], // Empty - should fail
    dedupeKeyTemplate: "{failureModeId}",
    minSampleSize: 1,
  };

  assert.throws(() => registry.register(p0Mode), /P0 Mission failure modes require a gate or runbook/);
});

test("MissionFailureModeRegistry accepts P0 with gate", () => {
  const registry = new MissionFailureModeRegistry();

  const p0Mode: MissionFailureMode = {
    failureModeId: "fm-p0-002",
    severity: "P0",
    missionProfile: "*",
    stageId: "deploy",
    triggerCondition: {
      type: "metric_threshold",
      metric: "error_rate",
      operator: ">=",
      value: 0.1,
    },
    defaultAction: "halt",
    linkedGateIds: ["GATE-001"],
    linkedRunbookIds: [],
    dedupeKeyTemplate: "{failureModeId}",
    minSampleSize: 1,
  };

  const registered = registry.register(p0Mode);
  assert.equal(registered.severity, "P0");
});

test("MissionFailureModeRegistry suppresses failure mode", () => {
  const registry = new MissionFailureModeRegistry();

  const mode: MissionFailureMode = {
    failureModeId: "fm-002",
    severity: "P1",
    missionProfile: "*",
    stageId: "design",
    triggerCondition: {
      type: "event_count",
      eventName: "error",
      operator: ">=",
      value: 3,
    },
    defaultAction: "alert",
    linkedGateIds: [],
    linkedRunbookIds: ["rb-001"],
    dedupeKeyTemplate: "{missionId}:{stageId}",
    minSampleSize: 5,
  };

  registry.register(mode);

  const suppression: MissionFailureModeSuppression = {
    failureModeId: "fm-002",
    dedupeKey: "mission-test-001:design",
    owner: "ops-team",
    auditRef: "audit-ref-001",
    approvalRef: "approval-ref-001",
    expiresAt: "2027-01-01T00:00:00.000Z",
  };

  const result = registry.suppress(suppression);
  assert.equal(result.failureModeId, "fm-002");
});

test("MissionFailureModeRegistry suppress requires approval for P0", () => {
  const registry = new MissionFailureModeRegistry();

  const p0Mode: MissionFailureMode = {
    failureModeId: "fm-p0-suppress",
    severity: "P0",
    missionProfile: "*",
    stageId: "deploy",
    triggerCondition: {
      type: "metric_threshold",
      metric: "error_rate",
      operator: ">=",
      value: 0.1,
    },
    defaultAction: "halt",
    linkedGateIds: ["GATE-001"],
    linkedRunbookIds: [],
    suppressionRequiresApproval: true,
    dedupeKeyTemplate: "{failureModeId}",
    minSampleSize: 1,
  };

  registry.register(p0Mode);

  const suppression: MissionFailureModeSuppression = {
    failureModeId: "fm-p0-suppress",
    dedupeKey: "test-dedupe",
    owner: "ops-team",
    auditRef: "audit-ref-001",
    approvalRef: null, // No approval - should fail
    expiresAt: "2027-01-01T00:00:00.000Z",
  };

  assert.throws(() => registry.suppress(suppression), /suppression requires approval/);
});

test("MissionFailureModeRegistry detect finds matching modes", () => {
  const registry = new MissionFailureModeRegistry();

  const mode: MissionFailureMode = {
    failureModeId: "fm-detect-001",
    severity: "P1",
    missionProfile: "formal",
    stageId: "design",
    triggerCondition: {
      type: "metric_threshold",
      metric: "execution_time_ms",
      operator: ">=",
      value: 500,
    },
    defaultAction: "alert",
    linkedGateIds: [],
    linkedRunbookIds: ["rb-001"],
    dedupeKeyTemplate: "{missionId}:{stageId}",
    minSampleSize: 1,
  };

  registry.register(mode);

  const input: MissionFailureModeDetectionInput = {
    mission: createTestMissionRecord({ missionType: "formal" }),
    stageInstance: createTestStageInstance({ stageId: "design" }),
    snapshot: createTestSnapshot(),
    evidenceRefs: ["evidence-1", "evidence-2"],
    sampleSize: 10,
    traceId: "trace-001",
    correlationId: "corr-001",
  };

  const detections = registry.detect(input);
  assert.equal(detections.length, 1);
  assert.equal(detections[0]!.failureModeId, "fm-detect-001");
});

test("MissionFailureModeRegistry detect filters by stage", () => {
  const registry = new MissionFailureModeRegistry();

  const mode: MissionFailureMode = {
    failureModeId: "fm-stage-filter",
    severity: "P1",
    missionProfile: "*",
    stageId: "design",
    triggerCondition: {
      type: "metric_threshold",
      metric: "execution_time_ms",
      operator: ">=",
      value: 0,
    },
    defaultAction: "alert",
    linkedGateIds: [],
    linkedRunbookIds: [],
    dedupeKeyTemplate: "{failureModeId}",
    minSampleSize: 1,
  };

  registry.register(mode);

  // Create input for different stage
  const input: MissionFailureModeDetectionInput = {
    mission: createTestMissionRecord(),
    stageInstance: createTestStageInstance({ stageId: "deploy" }), // Different stage
    snapshot: createTestSnapshot(),
    evidenceRefs: ["evidence-1"],
    traceId: "trace-001",
    correlationId: "corr-001",
  };

  const detections = registry.detect(input);
  assert.equal(detections.length, 0);
});

test("MissionFailureModeRegistry detect respects minSampleSize", () => {
  const registry = new MissionFailureModeRegistry();

  const mode: MissionFailureMode = {
    failureModeId: "fm-sample-size",
    severity: "P1",
    missionProfile: "*",
    stageId: "design",
    triggerCondition: {
      type: "metric_threshold",
      metric: "execution_time_ms",
      operator: ">=",
      value: 0,
    },
    defaultAction: "alert",
    linkedGateIds: [],
    linkedRunbookIds: [],
    dedupeKeyTemplate: "{failureModeId}",
    minSampleSize: 10, // Requires 10 samples
  };

  registry.register(mode);

  const input: MissionFailureModeDetectionInput = {
    mission: createTestMissionRecord(),
    stageInstance: createTestStageInstance(),
    snapshot: createTestSnapshot(),
    evidenceRefs: ["e1", "e2", "e3"], // Only 3 samples
    sampleSize: 3,
    traceId: "trace-001",
    correlationId: "corr-001",
  };

  const detections = registry.detect(input);
  assert.equal(detections.length, 0);
});

// ============================================
// WorkflowRecordingService Tests
// ============================================

test("WorkflowRecordingService registers policy", () => {
  const service = new WorkflowRecordingService();

  const policy: WorkflowRecordingPolicy = {
    policyId: "policy-001",
    allowedSurfaces: ["editor", "shell"],
    allowedDataClasses: ["internal", "restricted"],
    captureMode: "record",
    retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    requireConsentForRestricted: false,
    requireRedactionForRestricted: false,
  };

  const registered = service.registerPolicy(policy);
  assert.equal(registered.policyId, "policy-001");
});

test("WorkflowRecordingService complete creates trace", () => {
  const service = new WorkflowRecordingService();

  service.registerPolicy({
    policyId: "policy-complete",
    allowedSurfaces: ["editor"],
    allowedDataClasses: ["internal"],
    captureMode: "record",
    retentionMs: 7 * 24 * 60 * 60 * 1000,
    requireConsentForRestricted: false,
    requireRedactionForRestricted: false,
  });

  const input: WorkflowRecordingInput = {
    tenantId: "tenant-001",
    surface: "editor",
    policyId: "policy-complete",
    dataClass: "internal",
    summary: "Test workflow",
    stepSummaries: ["Step 1", "Step 2"],
    toolRefs: ["tool-1", "tool-2"],
  };

  const trace = service.complete(input);
  assert.ok(trace.traceId.startsWith("wtrace_"));
  assert.equal(trace.tenantId, "tenant-001");
  assert.equal(trace.surface, "editor");
});

test("WorkflowRecordingService complete requires enabled policy", () => {
  const service = new WorkflowRecordingService();

  service.registerPolicy({
    policyId: "policy-disabled",
    allowedSurfaces: ["editor"],
    allowedDataClasses: ["internal"],
    captureMode: "disabled", // Disabled!
    retentionMs: 7 * 24 * 60 * 60 * 1000,
    requireConsentForRestricted: false,
    requireRedactionForRestricted: false,
  });

  const input: WorkflowRecordingInput = {
    tenantId: "tenant-001",
    surface: "editor",
    policyId: "policy-disabled",
    dataClass: "internal",
    summary: "Test",
    stepSummaries: [],
    toolRefs: [],
  };

  assert.throws(() => service.complete(input), /workflow recording policy required/);
});

test("WorkflowRecordingService complete rejects disallowed surface", () => {
  const service = new WorkflowRecordingService();

  service.registerPolicy({
    policyId: "policy-surface-test",
    allowedSurfaces: ["editor"],
    allowedDataClasses: ["internal"],
    captureMode: "record",
    retentionMs: 7 * 24 * 60 * 60 * 1000,
    requireConsentForRestricted: false,
    requireRedactionForRestricted: false,
  });

  const input: WorkflowRecordingInput = {
    tenantId: "tenant-001",
    surface: "terminal", // Not allowed
    policyId: "policy-surface-test",
    dataClass: "internal",
    summary: "Test",
    stepSummaries: [],
    toolRefs: [],
  };

  assert.throws(() => service.complete(input), /surface.*not allowed/);
});

test("WorkflowRecordingService get returns stored trace", () => {
  const service = new WorkflowRecordingService();

  service.registerPolicy({
    policyId: "policy-get-test",
    allowedSurfaces: ["editor"],
    allowedDataClasses: ["internal"],
    captureMode: "record",
    retentionMs: 7 * 24 * 60 * 60 * 1000,
    requireConsentForRestricted: false,
    requireRedactionForRestricted: false,
  });

  const created = service.complete({
    tenantId: "tenant-001",
    surface: "editor",
    policyId: "policy-get-test",
    dataClass: "internal",
    summary: "Test trace",
    stepSummaries: [],
    toolRefs: [],
  });

  const retrieved = service.get(created.traceId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.traceId, created.traceId);
});

test("WorkflowRecordingService get returns null for unknown trace", () => {
  const service = new WorkflowRecordingService();

  const result = service.get("unknown-trace-id");
  assert.equal(result, null);
});

// ============================================
// SkillCandidatePipeline Tests
// ============================================

test("SkillCandidatePipeline creates candidate from valid trace", () => {
  const pipeline = new SkillCandidatePipeline();

  const trace: WorkflowTrace = {
    traceId: "trace-001",
    recordingId: "rec-001",
    tenantId: "tenant-001",
    surface: "editor",
    policyId: "policy-001",
    captureMode: "record",
    dataClass: "internal",
    consentRef: null,
    redactionReportRef: null,
    summary: "Test trace",
    stepSummaries: [],
    toolRefs: [],
    expiresAt: "2027-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    deletionProofRef: null,
  };

  const candidate = pipeline.createCandidate({
    trace,
    proposedSkillId: "skill-new",
    owner: "team-ops",
    policyDraftRef: "draft-001",
    evalSuiteRef: "eval-001",
    rollbackStrategyRef: "rollback-001",
    requiredPermissions: ["tool:invoke"],
  });

  assert.ok(candidate.candidateId.startsWith("skillcand_"));
  assert.equal(candidate.proposedSkillId, "skill-new");
  assert.equal(candidate.status, "draft");
});

test("SkillCandidatePipeline rejects trace without deletionProofRef for restricted", () => {
  const pipeline = new SkillCandidatePipeline();

  const trace: WorkflowTrace = {
    traceId: "trace-restricted",
    recordingId: "rec-001",
    tenantId: "tenant-001",
    surface: "editor",
    policyId: "policy-001",
    captureMode: "record",
    dataClass: "restricted",
    consentRef: null,
    redactionReportRef: null, // Missing!
    summary: "Test trace",
    stepSummaries: [],
    toolRefs: [],
    expiresAt: "2027-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    deletionProofRef: null,
  };

  assert.throws(
    () => pipeline.createCandidate({
      trace,
      proposedSkillId: "skill-new",
      owner: "team-ops",
      policyDraftRef: "draft-001",
      evalSuiteRef: "eval-001",
      rollbackStrategyRef: "rollback-001",
      requiredPermissions: [],
    }),
    /not eligible/,
  );
});

test("SkillCandidatePipeline requestReview updates status", () => {
  const pipeline = new SkillCandidatePipeline();

  const candidate = pipeline.createCandidate({
    trace: {
      traceId: "trace-001",
      recordingId: "rec-001",
      tenantId: "tenant-001",
      surface: "editor",
      policyId: "policy-001",
      captureMode: "record",
      dataClass: "internal",
      consentRef: null,
      redactionReportRef: null,
      summary: "Test",
      stepSummaries: [],
      toolRefs: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      deletionProofRef: "proof-001",
    },
    proposedSkillId: "skill-new",
    owner: "team-ops",
    policyDraftRef: "draft-001",
    evalSuiteRef: "eval-001",
    rollbackStrategyRef: "rollback-001",
    requiredPermissions: [],
  });

  const reviewed = pipeline.requestReview(candidate.candidateId);
  assert.equal(reviewed.status, "under_review");
});

test("SkillCandidatePipeline approve updates status and sets approvalRef", () => {
  const pipeline = new SkillCandidatePipeline();

  const candidate = pipeline.createCandidate({
    trace: {
      traceId: "trace-001",
      recordingId: "rec-001",
      tenantId: "tenant-001",
      surface: "editor",
      policyId: "policy-001",
      captureMode: "record",
      dataClass: "internal",
      consentRef: null,
      redactionReportRef: null,
      summary: "Test",
      stepSummaries: [],
      toolRefs: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      deletionProofRef: "proof-001",
    },
    proposedSkillId: "skill-new",
    owner: "team-ops",
    policyDraftRef: "draft-001",
    evalSuiteRef: "eval-001",
    rollbackStrategyRef: "rollback-001",
    requiredPermissions: [],
  });

  const approved = pipeline.approve(candidate.candidateId, "approval-ref-001");
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvalRef, "approval-ref-001");
});

test("SkillCandidatePipeline convertToSkillPack requires approved status", () => {
  const pipeline = new SkillCandidatePipeline();

  const candidate = pipeline.createCandidate({
    trace: {
      traceId: "trace-001",
      recordingId: "rec-001",
      tenantId: "tenant-001",
      surface: "editor",
      policyId: "policy-001",
      captureMode: "record",
      dataClass: "internal",
      consentRef: null,
      redactionReportRef: null,
      summary: "Test",
      stepSummaries: [],
      toolRefs: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      deletionProofRef: "proof-001",
    },
    proposedSkillId: "skill-new",
    owner: "team-ops",
    policyDraftRef: "draft-001",
    evalSuiteRef: "eval-001",
    rollbackStrategyRef: "rollback-001",
    requiredPermissions: [],
  });

  // Not approved yet
  assert.throws(
    () => pipeline.convertToSkillPack({
      candidateId: candidate.candidateId,
      version: "1.0.0",
      manifestValidationRef: "mv-001",
      policyValidationRef: "pv-001",
      sbomScanRef: "sbom-001",
      evalReportRef: "er-001",
      signatureRef: "sig-001",
      canaryEvidenceRef: "canary-001",
      rollbackRef: "rollback-001",
    }),
    /requires HITL approval/,
  );
});

test("SkillCandidatePipeline convertToSkillPack creates skill pack", () => {
  const pipeline = new SkillCandidatePipeline();

  const candidate = pipeline.createCandidate({
    trace: {
      traceId: "trace-001",
      recordingId: "rec-001",
      tenantId: "tenant-001",
      surface: "editor",
      policyId: "policy-001",
      captureMode: "record",
      dataClass: "internal",
      consentRef: null,
      redactionReportRef: null,
      summary: "Test",
      stepSummaries: [],
      toolRefs: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      deletionProofRef: "proof-001",
    },
    proposedSkillId: "skill-new",
    owner: "team-ops",
    policyDraftRef: "draft-001",
    evalSuiteRef: "eval-001",
    rollbackStrategyRef: "rollback-001",
    requiredPermissions: [],
  });

  pipeline.approve(candidate.candidateId, "approval-ref-001");

  const pack = pipeline.convertToSkillPack({
    candidateId: candidate.candidateId,
    version: "1.0.0",
    manifestValidationRef: "mv-001",
    policyValidationRef: "pv-001",
    sbomScanRef: "sbom-001",
    evalReportRef: "er-001",
    signatureRef: "sig-001",
    canaryEvidenceRef: "canary-001",
    rollbackRef: "rollback-001",
  });

  assert.equal(pack.skillId, "skill-new");
  assert.equal(pack.version, "1.0.0");
  assert.equal(pack.status, "active");
  assert.equal(pack.candidateId, candidate.candidateId);
});

test("SkillCandidatePipeline listPacks returns all packs", () => {
  const pipeline = new SkillCandidatePipeline();

  // Create and convert two candidates
  for (let i = 0; i < 2; i++) {
    const candidate = pipeline.createCandidate({
      trace: {
        traceId: `trace-${i}`,
        recordingId: `rec-${i}`,
        tenantId: "tenant-001",
        surface: "editor",
        policyId: "policy-001",
        captureMode: "record",
        dataClass: "internal",
        consentRef: null,
        redactionReportRef: null,
        summary: "Test",
        stepSummaries: [],
        toolRefs: [],
        expiresAt: "2027-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        deletionProofRef: "proof-001",
      },
      proposedSkillId: `skill-${i}`,
      owner: "team-ops",
      policyDraftRef: "draft-001",
      evalSuiteRef: "eval-001",
      rollbackStrategyRef: "rollback-001",
      requiredPermissions: [],
    });
    pipeline.approve(candidate.candidateId, `approval-${i}`);
    pipeline.convertToSkillPack({
      candidateId: candidate.candidateId,
      version: "1.0.0",
      manifestValidationRef: "mv-001",
      policyValidationRef: "pv-001",
      sbomScanRef: "sbom-001",
      evalReportRef: "er-001",
      signatureRef: "sig-001",
      canaryEvidenceRef: "canary-001",
      rollbackRef: "rollback-001",
    });
  }

  const packs = pipeline.listPacks();
  assert.equal(packs.length, 2);
});

// ============================================
// createBuiltinMissionPlaybooks Tests
// ============================================

test("createBuiltinMissionPlaybooks returns three playbooks", () => {
  const playbooks = createBuiltinMissionPlaybooks();

  assert.equal(playbooks.length, 3);
});

test("createBuiltinMissionPlaybooks contains research playbook", () => {
  const playbooks = createBuiltinMissionPlaybooks();

  const research = playbooks.find((p) => p.playbookId === "mission-playbook-research");
  assert.ok(research !== undefined);
  assert.equal(research!.missionType, "formal");
  assert.equal(research!.stages.length, 2);
});

test("createBuiltinMissionPlaybooks contains code playbook", () => {
  const playbooks = createBuiltinMissionPlaybooks();

  const code = playbooks.find((p) => p.playbookId === "mission-playbook-code");
  assert.ok(code !== undefined);
  assert.equal(code!.missionType, "program");
});

test("createBuiltinMissionPlaybooks contains ops playbook", () => {
  const playbooks = createBuiltinMissionPlaybooks();

  const ops = playbooks.find((p) => p.playbookId === "mission-playbook-ops");
  assert.ok(ops !== undefined);
  assert.equal(ops!.missionType, "incident");
});

test("createBuiltinMissionPlaybooks playbooks have valid structure", () => {
  const playbooks = createBuiltinMissionPlaybooks();

  for (const playbook of playbooks) {
    assert.ok(playbook.playbookId.length > 0);
    assert.ok(playbook.title.length > 0);
    assert.ok(playbook.stages.length > 0);
    assert.ok(playbook.edges.length > 0);
    assert.ok(playbook.entryStageId.length > 0);
  }
});

test("createBuiltinMissionPlaybooks uses custom timestamp", () => {
  const customTimestamp = "2025-01-01T00:00:00.000Z";
  const playbooks = createBuiltinMissionPlaybooks(customTimestamp);

  for (const playbook of playbooks) {
    assert.equal(playbook.createdAt, customTimestamp);
    assert.equal(playbook.updatedAt, customTimestamp);
  }
});