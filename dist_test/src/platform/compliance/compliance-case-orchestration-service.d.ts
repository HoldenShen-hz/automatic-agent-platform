import type { DataClassificationService } from "../control-plane/iam/data-classification-service.js";
import type { ClassificationResult, HandlingDecision, PiiAnnotation } from "../control-plane/iam/data-classification-service.js";
import type { ComplianceGovernanceService, ComplianceEvaluationResult } from "../../org-governance/compliance-engine/compliance-governance-service.js";
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
export declare class ComplianceCaseOrchestrationService {
    private readonly services;
    private readonly governance;
    private readonly encryption;
    private readonly residency;
    private readonly lineage;
    private readonly erasure;
    constructor(services: ComplianceCaseOrchestrationServiceOptions);
    prepareCrossRegionArtifactTransfer(input: {
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
    }): ComplianceTransferPackage;
    planSubjectErasureRequest(input: {
        actorId: string;
        orgNodeId: string;
        action: string;
        subjectRef: string;
        requestedBy: string;
        slaHours: number;
        targets: ErasureTarget[];
        requiredPolicyKeys?: readonly string[] | undefined;
    }): ComplianceErasurePackage;
    listLineage(sourceRef?: string): DataLineageEdge[];
    private evaluateGovernance;
    private resolveTransferStatus;
}
