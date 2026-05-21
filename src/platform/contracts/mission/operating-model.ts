import { z } from "zod";

import {
  ExitCriterionExpressionSchema,
  MissionPlaybookSchema,
  type ExitCriterionExpression,
} from "./playbook.js";

const ref = z.string().min(1);
const iso = z.string().min(1);

export const MissionFailureModeSchema = z.object({
  failureModeId: ref,
  missionProfile: ref,
  stageId: ref,
  name: ref,
  severity: z.enum(["P0", "P1", "P2"]),
  description: ref,
  triggerCondition: ExitCriterionExpressionSchema,
  linkedGateIds: z.array(ref),
  linkedRunbookIds: z.array(ref),
  defaultAction: z.enum(["block", "hold", "require_hitl", "rollback", "quarantine", "monitor"]),
  dedupeKeyTemplate: ref,
  minSampleSize: z.number().int().positive().default(1),
  suppressionRequiresApproval: z.boolean(),
  falsePositiveReviewRequired: z.boolean(),
  learningAction: z.enum(["create_eval", "update_skill", "update_playbook", "add_guardrail"]).optional(),
}).strict();
export type MissionFailureMode = z.infer<typeof MissionFailureModeSchema>;

export const MissionFailureModeDetectionSchema = z.object({
  detectionId: ref,
  failureModeId: ref,
  missionId: ref,
  stageInstanceId: ref,
  dedupeKey: ref,
  severity: z.enum(["P0", "P1", "P2"]),
  action: z.enum(["block", "hold", "require_hitl", "rollback", "quarantine", "monitor"]),
  evidenceRefs: z.array(ref),
  learningAction: z.enum(["create_eval", "update_skill", "update_playbook", "add_guardrail"]).nullable(),
  detectedAt: iso,
}).strict();
export type MissionFailureModeDetection = z.infer<typeof MissionFailureModeDetectionSchema>;

export const MissionOutcomeObservationSchema = z.object({
  observationId: ref,
  outcomeType: z.enum([
    "human_adoption",
    "experiment_created",
    "decision_adopted",
    "knowledge_promoted",
    "downstream_task_created",
  ]),
  source: z.enum(["manual_review", "system_event", "downstream_task", "external_integration"]),
  confidence: z.number().min(0).max(1),
  observedAt: iso,
  evidenceRefs: z.array(ref).min(1),
  reviewerRefs: z.array(ref).optional(),
}).strict();
export type MissionOutcomeObservation = z.infer<typeof MissionOutcomeObservationSchema>;

export const MissionOutcomeReportSchema = z.object({
  reportId: ref,
  missionId: ref,
  missionProfile: ref,
  generatedAt: iso,
  measurementWindow: z.enum(["immediate", "7d", "30d", "custom"]),
  reviewerRefs: z.array(ref),
  scores: z.object({
    executionScore: z.number().min(0).max(1),
    qualityScore: z.number().min(0).max(1),
    evidenceScore: z.number().min(0).max(1),
    adoptionScore: z.number().min(0).max(1).optional(),
    businessImpactScore: z.number().min(0).max(1).optional(),
  }).strict(),
  observations: z.array(MissionOutcomeObservationSchema),
  evidenceRefs: z.array(ref).min(1),
  scoresGeneratedFromRefs: z.array(ref).min(1),
  completion: z.object({
    completed: z.boolean(),
    terminalStatus: ref,
    stageCompletionRatio: z.number().min(0).max(1),
  }).strict(),
  cost: z.object({
    totalUsd: z.number().nonnegative(),
    costPerAcceptedOutput: z.number().nonnegative(),
  }).strict(),
}).strict();
export type MissionOutcomeReport = z.infer<typeof MissionOutcomeReportSchema>;

export const WorkflowRecordingPolicySchema = z.object({
  policyId: ref,
  captureMode: z.enum(["disabled", "redacted_summary", "structured_trace"]),
  allowedSurfaces: z.array(ref),
  allowedDataClasses: z.array(z.enum(["public", "internal", "confidential", "restricted"])),
  requireConsentForRestricted: z.boolean(),
  requireRedactionForRestricted: z.boolean(),
  retentionMs: z.number().int().positive(),
  owner: ref,
}).strict();
export type WorkflowRecordingPolicy = z.infer<typeof WorkflowRecordingPolicySchema>;

export const WorkflowTraceSchema = z.object({
  traceId: ref,
  recordingId: ref,
  tenantId: ref,
  surface: ref,
  policyId: ref,
  captureMode: z.enum(["redacted_summary", "structured_trace"]),
  dataClass: z.enum(["public", "internal", "confidential", "restricted"]),
  consentRef: ref.nullable(),
  redactionReportRef: ref.nullable(),
  summary: ref,
  stepSummaries: z.array(ref),
  toolRefs: z.array(ref),
  expiresAt: iso,
  createdAt: iso,
  deletionProofRef: ref.nullable(),
}).strict();
export type WorkflowTrace = z.infer<typeof WorkflowTraceSchema>;

export const WorkflowRecordingRetentionResultSchema = z.object({
  recordingId: ref,
  status: z.enum(["deleted", "deletion_failed", "retained"]),
  deletionProofRef: ref.nullable(),
  reasonCode: ref.nullable(),
  sweptAt: iso,
}).strict();
export type WorkflowRecordingRetentionResult = z.infer<typeof WorkflowRecordingRetentionResultSchema>;

export const SkillCandidateSchema = z.object({
  candidateId: ref,
  sourceWorkflowTraceRef: ref,
  proposedSkillId: ref,
  owner: ref,
  policyDraftRef: ref,
  evalSuiteRef: ref,
  rollbackStrategyRef: ref,
  requiredPermissions: z.array(ref),
  status: z.enum(["draft", "under_review", "approved", "rejected", "converted_to_skillpack"]),
  approvalRef: ref.nullable(),
  createdAt: iso,
}).strict();
export type SkillCandidate = z.infer<typeof SkillCandidateSchema>;

export const MissionSkillPackSchema = z.object({
  skillId: ref,
  version: ref,
  candidateId: ref,
  owner: ref,
  status: z.enum([
    "draft",
    "manifest_validated",
    "policy_validated",
    "sbom_scanned",
    "eval_passed",
    "signed",
    "canary",
    "active",
    "suspended",
    "deprecated",
    "revoked",
    "archived",
  ]),
  manifestValidationRef: ref.nullable(),
  policyValidationRef: ref.nullable(),
  sbomScanRef: ref.nullable(),
  evalReportRef: ref.nullable(),
  signatureRef: ref.nullable(),
  canaryEvidenceRef: ref.nullable(),
  rollbackRef: ref.nullable(),
}).strict();
export type MissionSkillPack = z.infer<typeof MissionSkillPackSchema>;

export const MissionOperatingModelRegistryPatchSchema = z.object({
  version: ref,
  gates: z.array(z.object({
    gateId: ref,
    defaultSeverity: z.enum(["P0", "P1", "P2", "P3"]),
    ciJob: ref,
    runbookId: ref,
    owner: ref,
  }).strict()).min(1),
  metrics: z.array(z.object({
    metric: ref,
    owner: ref,
    gateId: ref.optional(),
  }).strict()).min(1),
  events: z.array(ref).min(1),
  runbooks: z.array(z.object({
    runbookId: ref,
    linkedGateIds: z.array(ref).min(1),
    linkedMetrics: z.array(ref),
  }).strict()).min(1),
  ciJobs: z.array(z.object({
    jobId: ref,
    command: ref,
    artifact: ref,
    blocks: z.array(ref),
  }).strict()).min(1),
  playbooks: z.array(MissionPlaybookSchema).min(1),
}).strict();
export type MissionOperatingModelRegistryPatch = z.infer<typeof MissionOperatingModelRegistryPatchSchema>;

export type FailureModeTriggerExpression = ExitCriterionExpression;
