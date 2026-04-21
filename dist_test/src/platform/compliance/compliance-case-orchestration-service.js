import { newId, nowIso } from "../contracts/types/ids.js";
import { DataResidencyPolicyService } from "./data-residency/index.js";
import { FieldEncryptionService } from "./encryption/index.js";
import { ErasurePlanningService } from "./erasure/index.js";
import { DataLineageService } from "./lineage/index.js";
export class ComplianceCaseOrchestrationService {
    services;
    governance;
    encryption;
    residency;
    lineage;
    erasure;
    constructor(services) {
        this.services = services;
        this.governance = services.governance ?? null;
        this.encryption = services.encryption ?? new FieldEncryptionService();
        this.residency = services.residency ?? new DataResidencyPolicyService();
        this.lineage = services.lineage ?? new DataLineageService();
        this.erasure = services.erasure ?? new ErasurePlanningService();
    }
    prepareCrossRegionArtifactTransfer(input) {
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
        const reasons = [];
        if (transferDecision.action === "redact" || transferDecision.action === "audit") {
            exportContent = this.services.classification.redactContent(input.content, annotations);
            redactionApplied = exportContent !== input.content;
            if (redactionApplied) {
                reasons.push("classification_redaction_applied");
            }
        }
        else if (transferDecision.action === "summarize") {
            exportContent = `[SUMMARY OF ${classification.level.toUpperCase()} CONTENT - ORIGINAL EXCLUDED]`;
            redactionApplied = true;
            reasons.push("classification_summary_applied");
        }
        else if (transferDecision.action === "deny" && input.allowRedactedRestrictedTransfer === true && annotations.length > 0) {
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
        const lineageEdges = [];
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
    planSubjectErasureRequest(input) {
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
        const blockingReasons = [];
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
    listLineage(sourceRef) {
        return sourceRef == null ? this.lineage.listEdges() : this.lineage.traceFrom(sourceRef);
    }
    evaluateGovernance(input) {
        if (this.governance == null) {
            return null;
        }
        return this.governance.evaluate({
            actorId: input.actorId,
            orgNodeId: input.orgNodeId,
            action: input.action,
            occurredAt: input.occurredAt,
            ...(input.requiredPolicyKeys == null ? {} : { requiredPolicyKeys: input.requiredPolicyKeys }),
        }) ?? null;
    }
    resolveTransferStatus(input) {
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
}
//# sourceMappingURL=compliance-case-orchestration-service.js.map