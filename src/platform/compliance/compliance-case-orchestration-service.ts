import type { DataClassificationService } from "../five-plane-control-plane/iam/data-classification-service.js";
import type { ClassificationResult, HandlingDecision, PiiAnnotation } from "../five-plane-control-plane/iam/data-classification-service.js";
import { newId, nowIso } from "../contracts/types/ids.js";
import type { ComplianceGovernanceService, ComplianceEvaluationResult } from "../../org-governance/compliance-engine/compliance-governance-service.js";
import { buildGovernanceAuditRecord } from "../../org-governance/compliance-engine/audit-enforcer/index.js";
import type { ResidencyCheckResult, ResidencyPolicy } from "./data-residency/index.js";
import { DataResidencyPolicyService } from "./data-residency/index.js";
import type { FieldProtectionResult, FieldProtectionRule } from "./encryption/index.js";
import { FieldEncryptionService } from "./encryption/index.js";
import type { ErasurePlan, ErasureTarget } from "./erasure/index.js";
import { ErasurePlanningService } from "./erasure/index.js";
import type { DataLineageEdge } from "./lineage/index.js";
import { DataLineageService } from "./lineage/index.js";

export type ComplianceTransferStatus = "approved" | "requires_redaction" | "blocked";
export type ComplianceErasureStatus = "ready" | "blocked";

export interface ComplianceTransferPackage {
  transferId: string;
  status: ComplianceTransferStatus;
  classification: ClassificationResult;
  transferDecision: HandlingDecision;
  artifactDecision: HandlingDecision;
  governance: ComplianceEvaluationResult | null;
  residency: ResidencyCheckResult;
  annotations: PiiAnnotation[];
  redactionApplied: boolean;
  exportContent: string;
  protectedRecord: FieldProtectionResult;
  lineageEdges: DataLineageEdge[];
  reasons: string[];
  createdAt: string;
}

export interface ComplianceErasurePackage {
  requestId: string;
  status: ComplianceErasureStatus;
  governance: ComplianceEvaluationResult | null;
  plan: ErasurePlan;
  lineageEdges: DataLineageEdge[];
  blockingReasons: string[];
  createdAt: string;
}

export interface ComplianceCaseOrchestrationServiceOptions {
  classification: DataClassificationService;
  governance?: ComplianceGovernanceService | null;
  encryption?: FieldEncryptionService;
  residency?: DataResidencyPolicyService;
  lineage?: DataLineageService;
  erasure?: ErasurePlanningService;
}

export class ComplianceCaseOrchestrationService {
  private readonly governance: ComplianceGovernanceService | null;
  private readonly encryption: FieldEncryptionService;
  private readonly residency: DataResidencyPolicyService;
  private readonly lineage: DataLineageService;
  private readonly erasure: ErasurePlanningService;

  public constructor(
    private readonly services: ComplianceCaseOrchestrationServiceOptions,
  ) {
    this.governance = services.governance ?? null;
    this.encryption = services.encryption ?? new FieldEncryptionService();
    this.residency = services.residency ?? new DataResidencyPolicyService();
    this.lineage = services.lineage ?? new DataLineageService();
    this.erasure = services.erasure ?? new ErasurePlanningService();
  }

  public prepareCrossRegionArtifactTransfer(input: {
    actorId: string;
    orgNodeId: string;
    action: string;
    tenantId: string;
    sourceRegion: string;
    targetRegion: string;
    policy: ResidencyPolicy;
    content: string;
    artifactRef: string;
    exportRef: string;
    record: Record<string, unknown>;
    encryptionRules: FieldProtectionRule[];
    keyRef: string;
    requiredPolicyKeys?: readonly string[] | undefined;
    allowRedactedRestrictedTransfer?: boolean | undefined;
  }): ComplianceTransferPackage {
    const createdAt = nowIso();
    const classification = this.services.classification.classify(input.content, {
      source: "artifact",
      tenantId: input.tenantId,
    });
    const transferDecision = this.services.classification.getHandlingDecision(classification.level, "cross_worker", input.content);
    const artifactDecision = this.services.classification.getHandlingDecision(classification.level, "artifact", input.content);
    const governance = this.evaluateGovernance({
      actorId: input.actorId,
      orgNodeId: input.orgNodeId,
      action: input.action,
      requiredPolicyKeys: input.requiredPolicyKeys,
      occurredAt: createdAt,
    });
    const annotations = this.services.classification.detectPii(input.content);

    let exportContent = input.content;
    let redactionApplied = false;
    const reasons: string[] = [];

    if (transferDecision.action === "redact" || transferDecision.action === "audit") {
      exportContent = this.services.classification.redactContent(input.content, annotations);
      redactionApplied = exportContent !== input.content;
      if (redactionApplied) {
        reasons.push("classification_redaction_applied");
      }
    } else if (transferDecision.action === "summarize") {
      exportContent = `[SUMMARY OF ${classification.level.toUpperCase()} CONTENT - ORIGINAL EXCLUDED]`;
      redactionApplied = true;
      reasons.push("classification_summary_applied");
    } else if (transferDecision.action === "deny" && input.allowRedactedRestrictedTransfer === true && annotations.length > 0) {
      exportContent = this.services.classification.redactContent(input.content, annotations);
      redactionApplied = exportContent !== input.content;
      if (redactionApplied) {
        reasons.push("classification_override_redaction_applied");
      }
    }

    const protectedRecord = this.encryption.protectRecord({
      record: input.record,
      rules: input.encryptionRules,
      keyRef: input.keyRef,
    });
    const residency = this.residency.decideTransfer({
      policy: input.policy,
      sourceRegion: input.sourceRegion,
      targetRegion: input.targetRegion,
      classification: classification.level,
      redacted: redactionApplied,
    });

    if (governance != null && !governance.allowed) {
      reasons.push(...governance.missingKeys.map((key) => `governance_missing:${key}`));
    }
    if (artifactDecision.action === "deny") {
      reasons.push("artifact_handling_denied");
    }
    if (transferDecision.action === "deny" && !redactionApplied) {
      reasons.push("transfer_handling_denied");
    }
    if (residency.decision === "deny") {
      reasons.push(`residency:${residency.reason}`);
    }
    if (residency.decision === "require_redaction" && !redactionApplied) {
      reasons.push(`residency:${residency.reason}`);
    }

    const lineageEdges: DataLineageEdge[] = [];
    if (protectedRecord.protectedFields.length > 0) {
      lineageEdges.push(this.lineage.recordEdge({
        sourceRef: input.artifactRef,
        targetRef: `${input.exportRef}:encrypted`,
        kind: "encrypted_from",
        actorRef: input.actorId,
        policyRef: governance?.auditRecord.recordId ?? null,
        metadata: {
          protectedFieldCount: protectedRecord.protectedFields.length,
          classification: classification.level,
        },
      }));
    }

    const status = this.resolveTransferStatus({
      governanceAllowed: governance?.allowed ?? true,
      artifactDecision,
      transferDecision,
      residency,
      redactionApplied,
    });
    if (status !== "blocked") {
      lineageEdges.push(this.lineage.recordEdge({
        sourceRef: input.artifactRef,
        targetRef: input.exportRef,
        kind: redactionApplied ? "redacted_from" : "derived_from",
        actorRef: input.actorId,
        policyRef: governance?.auditRecord.recordId ?? null,
        metadata: {
          classification: classification.level,
          residencyDecision: residency.decision,
        },
      }));
      lineageEdges.push(this.lineage.recordEdge({
        sourceRef: input.exportRef,
        targetRef: `${input.targetRegion}:${input.exportRef}`,
        kind: "released_as",
        actorRef: input.actorId,
        policyRef: governance?.auditRecord.recordId ?? null,
        metadata: {
          targetRegion: input.targetRegion,
          redactionApplied,
        },
      }));
    }

    return {
      transferId: newId("compliance_transfer"),
      status,
      classification,
      transferDecision,
      artifactDecision,
      governance,
      residency,
      annotations,
      redactionApplied,
      exportContent,
      protectedRecord,
      lineageEdges,
      reasons,
      createdAt,
    };
  }

  public planSubjectErasureRequest(input: {
    actorId: string;
    orgNodeId: string;
    action: string;
    subjectRef: string;
    requestedBy: string;
    slaHours: number;
    targets: ErasureTarget[];
    requiredPolicyKeys?: readonly string[] | undefined;
  }): ComplianceErasurePackage {
    const createdAt = nowIso();
    const governance = this.evaluateGovernance({
      actorId: input.actorId,
      orgNodeId: input.orgNodeId,
      action: input.action,
      requiredPolicyKeys: input.requiredPolicyKeys,
      occurredAt: createdAt,
    });
    const plan = this.erasure.createPlan({
      subjectRef: input.subjectRef,
      requestedBy: input.requestedBy,
      targets: input.targets,
      slaHours: input.slaHours,
    });
    const blockingReasons: string[] = [];
    if (governance != null && !governance.allowed) {
      blockingReasons.push(...governance.missingKeys.map((key) => `governance_missing:${key}`));
    }
    if (plan.status === "blocked_by_legal_hold") {
      blockingReasons.push("plan_blocked_by_legal_hold");
    }

    const lineageEdges = plan.steps
      .filter((step) => step.action === "erase" || step.action === "redact")
      .map((step) => this.lineage.recordEdge({
        sourceRef: step.targetRef,
        targetRef: plan.requestId,
        kind: step.action === "erase" ? "erased_by" : "redacted_from",
        actorRef: input.actorId,
        policyRef: governance?.auditRecord.recordId ?? null,
        metadata: {
          subjectRef: input.subjectRef,
          action: step.action,
          reason: step.reason,
        },
      }));

    return {
      requestId: plan.requestId,
      status: blockingReasons.length === 0 ? "ready" : "blocked",
      governance,
      plan,
      lineageEdges,
      blockingReasons,
      createdAt,
    };
  }

  public listLineage(sourceRef?: string): DataLineageEdge[] {
    return sourceRef == null ? this.lineage.listEdges() : this.lineage.traceFrom(sourceRef);
  }

  private evaluateGovernance(input: {
    actorId: string;
    orgNodeId: string;
    action: string;
    requiredPolicyKeys?: readonly string[] | undefined;
    occurredAt: string;
  }): ComplianceEvaluationResult {
    if (this.governance == null) {
      return this.buildDeniedGovernanceResult(input, "governance_evaluator_unconfigured");
    }
    try {
      return this.governance.evaluate({
        actorId: input.actorId,
        orgNodeId: input.orgNodeId,
        action: input.action,
        occurredAt: input.occurredAt,
        ...(input.requiredPolicyKeys == null ? {} : { requiredPolicyKeys: input.requiredPolicyKeys }),
      }) ?? this.buildDeniedGovernanceResult(input, "governance_evaluation_returned_null");
    } catch {
      return this.buildDeniedGovernanceResult(input, "governance_evaluation_failed");
    }
  }

  private resolveTransferStatus(input: {
    governanceAllowed: boolean;
    artifactDecision: HandlingDecision;
    transferDecision: HandlingDecision;
    residency: ResidencyCheckResult;
    redactionApplied: boolean;
  }): ComplianceTransferStatus {
    if (!input.governanceAllowed) {
      return "blocked";
    }
    if (input.artifactDecision.action === "deny") {
      return "blocked";
    }
    if (input.transferDecision.action === "deny" && !input.redactionApplied) {
      return "blocked";
    }
    if (input.residency.decision === "deny") {
      return "blocked";
    }
    if (input.residency.decision === "require_redaction" && !input.redactionApplied) {
      return "requires_redaction";
    }
    return "approved";
  }

  private buildDeniedGovernanceResult(input: {
    actorId: string;
    orgNodeId: string;
    action: string;
    requiredPolicyKeys?: readonly string[] | undefined;
    occurredAt: string;
  }, reasonCode: string): ComplianceEvaluationResult {
    const missingKeys = [
      reasonCode,
      ...(input.requiredPolicyKeys ?? []).filter((key) => key !== reasonCode),
    ];
    return {
      orgNodeId: input.orgNodeId,
      effectivePolicy: {},
      allowed: false,
      missingKeys,
      applicableFrameworks: [],
      missingControls: [],
      auditRecord: buildGovernanceAuditRecord({
        recordId: newId("governance_audit"),
        action: input.action,
        actorId: input.actorId,
        orgNodeId: input.orgNodeId,
        allowed: false,
        reasonCodes: [reasonCode],
        occurredAt: input.occurredAt,
      }),
    };
  }
}
