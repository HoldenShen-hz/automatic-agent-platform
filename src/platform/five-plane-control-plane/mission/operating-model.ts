import { newId, nowIso } from "../../contracts/types/ids.js";
import { AppError } from "../../contracts/errors.js";
import {
  MissionFailureModeDetectionSchema,
  MissionFailureModeSchema,
  MissionOutcomeReportSchema,
  MissionPlaybookSchema,
  MissionSkillPackSchema,
  SkillCandidateSchema,
  WorkflowRecordingPolicySchema,
  WorkflowRecordingRetentionResultSchema,
  WorkflowTraceSchema,
  type ExitCriterionExpression,
  type MissionFailureMode,
  type MissionFailureModeDetection,
  type MissionOutcomeReport,
  type MissionPlaybook,
  type MissionRecord,
  type MissionSkillPack,
  type MissionStageInstance,
  type SkillCandidate,
  type StageExitSnapshot,
  type WorkflowRecordingPolicy,
  type WorkflowRecordingRetentionResult,
  type WorkflowTrace,
} from "../../contracts/mission/index.js";
import type { MissionRepository } from "../../five-plane-state-evidence/truth/mission-repository.js";

export interface MissionFailureModeDetectionInput {
  readonly mission: MissionRecord;
  readonly stageInstance: MissionStageInstance;
  readonly snapshot: StageExitSnapshot;
  readonly evidenceRefs: readonly string[];
  readonly sampleSize?: number;
  readonly traceId: string;
  readonly correlationId: string;
  readonly detectedAt?: string;
}

export interface MissionFailureModeSuppression {
  readonly failureModeId: string;
  readonly dedupeKey: string;
  readonly owner: string;
  readonly auditRef: string;
  readonly approvalRef: string | null;
  readonly expiresAt: string;
}

export class MissionFailureModeRegistry {
  private readonly modes = new Map<string, MissionFailureMode>();
  private readonly detections = new Map<string, MissionFailureModeDetection>();
  private readonly suppressions = new Map<string, MissionFailureModeSuppression>();

  public constructor(private readonly repository?: MissionRepository) {}

  public register(input: MissionFailureMode): MissionFailureMode {
    const mode = MissionFailureModeSchema.parse(input);
    if (mode.severity === "P0" && mode.linkedGateIds.length === 0 && mode.linkedRunbookIds.length === 0) {
      throwOperatingModelError("mission.failure_mode_p0_unrouted", "P0 Mission failure modes require a gate or runbook", {
        failureModeId: mode.failureModeId,
      });
    }
    this.modes.set(mode.failureModeId, mode);
    return mode;
  }

  public list(): readonly MissionFailureMode[] {
    return [...this.modes.values()];
  }

  public suppress(input: MissionFailureModeSuppression): MissionFailureModeSuppression {
    const mode = this.modes.get(input.failureModeId);
    if (mode == null) {
      throwOperatingModelError("mission.failure_mode_not_found", "Mission failure mode suppression requires a registered mode", {
        failureModeId: input.failureModeId,
      });
    }
    if (mode.severity === "P0" || mode.suppressionRequiresApproval) {
      if (input.approvalRef == null) {
        throwOperatingModelError("mission.failure_mode_suppression_approval_required", "Mission failure mode suppression requires approval", {
          failureModeId: input.failureModeId,
        });
      }
    }
    this.suppressions.set(suppressionKey(input.failureModeId, input.dedupeKey), input);
    return input;
  }

  public detect(input: MissionFailureModeDetectionInput): readonly MissionFailureModeDetection[] {
    const detectedAt = input.detectedAt ?? nowIso();
    const detections: MissionFailureModeDetection[] = [];
    for (const mode of this.modes.values()) {
      if (mode.stageId !== input.stageInstance.stageId || (mode.missionProfile !== "*" && mode.missionProfile !== input.mission.type)) {
        continue;
      }
      if ((input.sampleSize ?? input.evidenceRefs.length) < mode.minSampleSize || !evaluateTrigger(mode.triggerCondition, input.snapshot)) {
        continue;
      }
      const dedupeKey = renderDedupeKey(mode, input);
      if (this.isSuppressed(mode, dedupeKey, detectedAt) || this.detections.has(suppressionKey(mode.failureModeId, dedupeKey))) {
        continue;
      }
      const detection = MissionFailureModeDetectionSchema.parse({
        detectionId: newId("mfail"),
        failureModeId: mode.failureModeId,
        missionId: input.mission.missionId,
        stageInstanceId: input.stageInstance.stageInstanceId,
        dedupeKey,
        severity: mode.severity,
        action: mode.defaultAction,
        evidenceRefs: [...input.evidenceRefs],
        learningAction: mode.learningAction ?? null,
        detectedAt,
      });
      this.detections.set(suppressionKey(mode.failureModeId, dedupeKey), detection);
      this.repository?.appendEvent({
        eventType: "platform.mission.failure_mode_detected",
        missionId: input.mission.missionId,
        tenantId: input.mission.tenantId,
        traceId: input.traceId,
        correlationId: input.correlationId,
        occurredAt: detectedAt,
        payload: {
          detectionId: detection.detectionId,
          failureModeId: detection.failureModeId,
          stageInstanceId: detection.stageInstanceId,
          dedupeKey: detection.dedupeKey,
          severity: detection.severity,
          action: detection.action,
          evidenceRefs: detection.evidenceRefs,
        },
      });
      detections.push(detection);
    }
    return detections;
  }

  private isSuppressed(mode: MissionFailureMode, dedupeKey: string, timestamp: string): boolean {
    const suppression = this.suppressions.get(suppressionKey(mode.failureModeId, dedupeKey));
    return suppression != null && suppression.expiresAt > timestamp;
  }
}

export class MissionOutcomeMeasurementService {
  public constructor(private readonly repository?: MissionRepository) {}

  public measure(input: Omit<MissionOutcomeReport, "reportId" | "generatedAt"> & {
    readonly reportId?: string;
    readonly generatedAt?: string;
    readonly traceId: string;
    readonly correlationId: string;
    readonly tenantId: string;
  }): MissionOutcomeReport {
    const {
      reportId,
      generatedAt,
      traceId,
      correlationId,
      tenantId,
      ...reportInput
    } = input;
    const report = MissionOutcomeReportSchema.parse({
      ...reportInput,
      reportId: reportId ?? newId("moutcome"),
      generatedAt: generatedAt ?? nowIso(),
    });
    this.repository?.appendEvent({
      eventType: "platform.mission.outcome_measured",
      missionId: report.missionId,
      tenantId,
      traceId,
      correlationId,
      occurredAt: report.generatedAt,
      payload: {
        reportId: report.reportId,
        missionProfile: report.missionProfile,
        measurementWindow: report.measurementWindow,
        scores: {
          executionScore: report.scores.executionScore,
          qualityScore: report.scores.qualityScore,
          evidenceScore: report.scores.evidenceScore,
          adoptionScore: report.scores.adoptionScore ?? null,
          businessImpactScore: report.scores.businessImpactScore ?? null,
        },
        observationCount: report.observations.length,
        evidenceRefs: report.evidenceRefs,
      },
    });
    return report;
  }
}

export interface WorkflowRecordingInput {
  readonly recordingId?: string;
  readonly tenantId: string;
  readonly surface: string;
  readonly policyId: string;
  readonly dataClass: WorkflowTrace["dataClass"];
  readonly consentRef?: string | null;
  readonly redactionReportRef?: string | null;
  readonly summary: string;
  readonly stepSummaries: readonly string[];
  readonly toolRefs: readonly string[];
  readonly createdAt?: string;
}

export class WorkflowRecordingService {
  private readonly policies = new Map<string, WorkflowRecordingPolicy>();
  private readonly traces = new Map<string, WorkflowTrace>();

  public registerPolicy(input: WorkflowRecordingPolicy): WorkflowRecordingPolicy {
    const policy = WorkflowRecordingPolicySchema.parse(input);
    this.policies.set(policy.policyId, policy);
    return policy;
  }

  public complete(input: WorkflowRecordingInput): WorkflowTrace {
    const policy = this.policies.get(input.policyId);
    if (policy == null || policy.captureMode === "disabled") {
      throwOperatingModelError("mission.workflow_recording_policy_required", "Workflow recording requires an enabled policy", {
        policyId: input.policyId,
      });
    }
    if (!policy.allowedSurfaces.includes(input.surface) || !policy.allowedDataClasses.includes(input.dataClass)) {
      throwOperatingModelError("mission.workflow_recording_surface_denied", "Workflow recording surface or data class is not allowed", {
        policyId: policy.policyId,
        surface: input.surface,
        dataClass: input.dataClass,
      });
    }
    if (input.dataClass === "restricted") {
      if (policy.requireConsentForRestricted && input.consentRef == null) {
        throwOperatingModelError("mission.workflow_recording_consent_required", "Restricted workflow recording requires consent", {
          policyId: policy.policyId,
        });
      }
      if (policy.requireRedactionForRestricted && input.redactionReportRef == null) {
        throwOperatingModelError("mission.workflow_recording_redaction_required", "Restricted workflow recording requires a redaction report", {
          policyId: policy.policyId,
        });
      }
    }
    const createdAt = input.createdAt ?? nowIso();
    const trace = WorkflowTraceSchema.parse({
      traceId: newId("wtrace"),
      recordingId: input.recordingId ?? newId("wrec"),
      tenantId: input.tenantId,
      surface: input.surface,
      policyId: policy.policyId,
      captureMode: policy.captureMode,
      dataClass: input.dataClass,
      consentRef: input.consentRef ?? null,
      redactionReportRef: input.redactionReportRef ?? null,
      summary: input.summary,
      stepSummaries: [...input.stepSummaries],
      toolRefs: [...input.toolRefs],
      expiresAt: new Date(Date.parse(createdAt) + policy.retentionMs).toISOString(),
      createdAt,
      deletionProofRef: null,
    });
    this.traces.set(trace.traceId, trace);
    return trace;
  }

  public get(traceId: string): WorkflowTrace | null {
    return this.traces.get(traceId) ?? null;
  }

  public sweepRetention(input: {
    readonly sweptAt?: string;
    readonly deletionProofFor?: (trace: WorkflowTrace) => string | null;
  } = {}): readonly WorkflowRecordingRetentionResult[] {
    const sweptAt = input.sweptAt ?? nowIso();
    const results: WorkflowRecordingRetentionResult[] = [];
    for (const trace of this.traces.values()) {
      if (trace.expiresAt > sweptAt) {
        results.push(WorkflowRecordingRetentionResultSchema.parse({
          recordingId: trace.recordingId,
          status: "retained",
          deletionProofRef: null,
          reasonCode: null,
          sweptAt,
        }));
        continue;
      }
      const deletionProofRef = input.deletionProofFor?.(trace) ?? `deletion:${trace.traceId}`;
      if (deletionProofRef == null) {
        results.push(WorkflowRecordingRetentionResultSchema.parse({
          recordingId: trace.recordingId,
          status: "deletion_failed",
          deletionProofRef: null,
          reasonCode: "mission.workflow_recording.deletion_proof_missing",
          sweptAt,
        }));
        continue;
      }
      this.traces.delete(trace.traceId);
      results.push(WorkflowRecordingRetentionResultSchema.parse({
        recordingId: trace.recordingId,
        status: "deleted",
        deletionProofRef,
        reasonCode: null,
        sweptAt,
      }));
    }
    return results;
  }
}

export class SkillCandidatePipeline {
  private readonly candidates = new Map<string, SkillCandidate>();
  private readonly packs = new Map<string, MissionSkillPack>();

  public createCandidate(input: {
    readonly trace: WorkflowTrace;
    readonly proposedSkillId: string;
    readonly owner: string;
    readonly policyDraftRef: string;
    readonly evalSuiteRef: string;
    readonly rollbackStrategyRef: string;
    readonly requiredPermissions: readonly string[];
    readonly createdAt?: string;
  }): SkillCandidate {
    if (input.trace.deletionProofRef != null || input.trace.dataClass === "restricted" && input.trace.redactionReportRef == null) {
      throwOperatingModelError("mission.skill_candidate_trace_unsafe", "Workflow trace is not eligible for SkillCandidate promotion", {
        traceId: input.trace.traceId,
      });
    }
    const candidate = SkillCandidateSchema.parse({
      candidateId: newId("skillcand"),
      sourceWorkflowTraceRef: input.trace.traceId,
      proposedSkillId: input.proposedSkillId,
      owner: input.owner,
      policyDraftRef: input.policyDraftRef,
      evalSuiteRef: input.evalSuiteRef,
      rollbackStrategyRef: input.rollbackStrategyRef,
      requiredPermissions: [...input.requiredPermissions],
      status: "draft",
      approvalRef: null,
      createdAt: input.createdAt ?? nowIso(),
    });
    this.candidates.set(candidate.candidateId, candidate);
    return candidate;
  }

  public requestReview(candidateId: string): SkillCandidate {
    return this.updateCandidate(candidateId, { status: "under_review" });
  }

  public approve(candidateId: string, approvalRef: string): SkillCandidate {
    return this.updateCandidate(candidateId, { status: "approved", approvalRef });
  }

  public convertToSkillPack(input: {
    readonly candidateId: string;
    readonly version: string;
    readonly manifestValidationRef: string;
    readonly policyValidationRef: string;
    readonly sbomScanRef: string;
    readonly evalReportRef: string;
    readonly signatureRef: string;
    readonly canaryEvidenceRef: string;
    readonly rollbackRef: string;
  }): MissionSkillPack {
    const candidate = this.candidates.get(input.candidateId);
    if (candidate == null || candidate.status !== "approved" || candidate.approvalRef == null) {
      throwOperatingModelError("mission.skill_candidate_conversion_denied", "SkillCandidate requires HITL approval before SkillPack conversion", {
        candidateId: input.candidateId,
      });
    }
    const pack = MissionSkillPackSchema.parse({
      skillId: candidate.proposedSkillId,
      version: input.version,
      candidateId: candidate.candidateId,
      owner: candidate.owner,
      status: "active",
      manifestValidationRef: input.manifestValidationRef,
      policyValidationRef: input.policyValidationRef,
      sbomScanRef: input.sbomScanRef,
      evalReportRef: input.evalReportRef,
      signatureRef: input.signatureRef,
      canaryEvidenceRef: input.canaryEvidenceRef,
      rollbackRef: input.rollbackRef,
    });
    this.packs.set(`${pack.skillId}@${pack.version}`, pack);
    this.updateCandidate(candidate.candidateId, { status: "converted_to_skillpack" });
    return pack;
  }

  public listPacks(): readonly MissionSkillPack[] {
    return [...this.packs.values()];
  }

  private updateCandidate(candidateId: string, patch: Partial<SkillCandidate>): SkillCandidate {
    const current = this.candidates.get(candidateId);
    if (current == null) {
      throwOperatingModelError("mission.skill_candidate_not_found", "SkillCandidate was not found", { candidateId });
    }
    const updated = SkillCandidateSchema.parse({ ...current, ...patch });
    this.candidates.set(candidateId, updated);
    return updated;
  }
}

export function createBuiltinMissionPlaybooks(timestamp = "2026-05-21T00:00:00.000Z"): readonly MissionPlaybook[] {
  return [
    createBuiltinPlaybook({
      playbookId: "mission-playbook-research",
      missionType: "formal",
      title: "Research evidence playbook",
      firstStage: "scope",
      secondStage: "evidence_review",
      firstEvidence: "research_brief",
      secondEvidence: "claim_evidence",
      firstSkill: "skill:research-scope",
      secondSkill: "skill:research-critic",
      timestamp,
    }),
    createBuiltinPlaybook({
      playbookId: "mission-playbook-code",
      missionType: "program",
      title: "Code delivery playbook",
      firstStage: "design",
      secondStage: "verification",
      firstEvidence: "plan_bundle",
      secondEvidence: "test_report",
      firstSkill: "skill:code-plan",
      secondSkill: "skill:code-review",
      timestamp,
    }),
    createBuiltinPlaybook({
      playbookId: "mission-playbook-ops",
      missionType: "incident",
      title: "Incident response playbook",
      firstStage: "triage",
      secondStage: "stabilize",
      firstEvidence: "incident_snapshot",
      secondEvidence: "rollback_or_fix_evidence",
      firstSkill: "skill:ops-triage",
      secondSkill: "skill:ops-stabilize",
      timestamp,
    }),
  ];
}

function createBuiltinPlaybook(input: {
  readonly playbookId: string;
  readonly missionType: MissionPlaybook["missionType"];
  readonly title: string;
  readonly firstStage: string;
  readonly secondStage: string;
  readonly firstEvidence: string;
  readonly secondEvidence: string;
  readonly firstSkill: string;
  readonly secondSkill: string;
  readonly timestamp: string;
}): MissionPlaybook {
  return MissionPlaybookSchema.parse({
    playbookId: input.playbookId,
    version: "1.0.0",
    missionType: input.missionType,
    title: input.title,
    owner: "mission-ops",
    status: "active",
    entryStageId: input.firstStage,
    stages: [{
      stageId: input.firstStage,
      title: `${input.title} start`,
      exitCriteria: [{
        criterionId: `${input.firstStage}.evidence`,
        name: "Entry evidence captured",
        severity: "P0",
        gateId: "GATE-MISSION-PLAYBOOK-001",
        expression: { type: "evidence_exists", evidenceKind: input.firstEvidence, minCount: 1 },
        requiredEvidenceRefs: [`evidence:${input.firstEvidence}`],
        requiredMetricRefs: [],
        failureModeRef: `failure:${input.firstStage}:missing_evidence`,
      }],
      failureModeRefs: [`failure:${input.firstStage}:missing_evidence`],
      defaultSkillRefs: [input.firstSkill],
      evidenceRequirements: [input.firstEvidence],
    }, {
      stageId: input.secondStage,
      title: `${input.title} exit`,
      exitCriteria: [{
        criterionId: `${input.secondStage}.evidence`,
        name: "Exit evidence captured",
        severity: "P1",
        gateId: "GATE-MISSION-OUTCOME-001",
        expression: { type: "evidence_exists", evidenceKind: input.secondEvidence, minCount: 1 },
        requiredEvidenceRefs: [`evidence:${input.secondEvidence}`],
        requiredMetricRefs: [],
        failureModeRef: `failure:${input.secondStage}:missing_evidence`,
      }],
      failureModeRefs: [`failure:${input.secondStage}:missing_evidence`],
      defaultSkillRefs: [input.secondSkill],
      evidenceRequirements: [input.secondEvidence],
    }],
    edges: [{
      edgeId: `${input.firstStage}_to_${input.secondStage}`,
      fromStageId: input.firstStage,
      toStageId: input.secondStage,
      requiredGateIds: ["GATE-MISSION-PLAYBOOK-001", "GATE-MISSION-OUTCOME-001"],
      requiresHitl: true,
      requiredCapabilities: ["mission.stage.advance"],
    }],
    signatureRef: `signature:${input.playbookId}:1.0.0`,
    rollbackRef: `rollback:${input.playbookId}:1.0.0`,
    compatibilityRef: `compat:${input.playbookId}:1.0.0`,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  });
}

function evaluateTrigger(expression: ExitCriterionExpression, snapshot: StageExitSnapshot): boolean {
  if (expression.type === "metric_threshold") {
    const actual = snapshot.metricValues[expression.metric];
    return actual != null && compare(actual, expression.operator, expression.value);
  }
  if (expression.type === "event_count") {
    return compare(snapshot.eventCounts[expression.eventName] ?? 0, expression.operator, expression.value);
  }
  if (expression.type === "evidence_exists") {
    return (snapshot.evidenceCounts[expression.evidenceKind] ?? 0) >= (expression.minCount ?? 1);
  }
  if (expression.type === "hitl_decision") {
    return snapshot.hitlDecisions[expression.decisionType] === expression.requiredDecision;
  }
  if (expression.type === "all_of") {
    return expression.criteria.every((criterion) => evaluateTrigger(criterion, snapshot));
  }
  if (expression.type === "any_of") {
    return expression.criteria.some((criterion) => evaluateTrigger(criterion, snapshot));
  }
  if (expression.type === "not") {
    return !evaluateTrigger(expression.criterion, snapshot);
  }
  return false;
}

function compare(
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
  if (operator === ">=") {
    return actual >= expected;
  }
  if (operator === ">") {
    return actual > expected;
  }
  if (operator === "<=") {
    return actual <= expected;
  }
  return actual < expected;
}

function renderDedupeKey(mode: MissionFailureMode, input: MissionFailureModeDetectionInput): string {
  return mode.dedupeKeyTemplate
    .replaceAll("{failureModeId}", mode.failureModeId)
    .replaceAll("{missionId}", input.mission.missionId)
    .replaceAll("{stageInstanceId}", input.stageInstance.stageInstanceId)
    .replaceAll("{stageId}", input.stageInstance.stageId);
}

function suppressionKey(failureModeId: string, dedupeKey: string): string {
  return `${failureModeId}:${dedupeKey}`;
}

function throwOperatingModelError(code: string, message: string, details: Record<string, unknown>): never {
  throw new AppError(code, message, {
    category: "business-rule",
    source: "policy",
    statusCode: 409,
    retryable: false,
    details,
  });
}
