import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { resolvePromptTemplate } from "./index.js";
export class DomainPromptGovernanceService {
    releases = new Map();
    activeReleaseByPromptId = new Map();
    review(library, promptId) {
        const prompt = resolvePromptTemplate(library, promptId);
        if (prompt == null) {
            throw new Error(`prompt_governance.prompt_not_found:${promptId}`);
        }
        return {
            promptId: prompt.promptId,
            domainId: library.domainId,
            version: prompt.version,
            stage: prompt.stage,
            guardrails: prompt.guardrails,
            reviewRequired: prompt.guardrails.length > 0,
            cacheSegments: ["fixed_prefix", "domain_block", "variable_suffix"],
        };
    }
    proposeRelease(library, draft) {
        const review = this.review(library, draft.promptId);
        if (draft.lintEvidence.length === 0) {
            throw new Error("prompt_governance.lint_evidence_required");
        }
        if (draft.evalEvidence.length === 0) {
            throw new Error("prompt_governance.eval_evidence_required");
        }
        if (review.reviewRequired && (draft.approvalTicketId == null || draft.approvalTicketId.trim().length === 0)) {
            throw new Error("prompt_governance.approval_ticket_required");
        }
        const releaseId = newId("prompt_release");
        const record = {
            releaseId,
            promptId: review.promptId,
            domainId: review.domainId,
            version: review.version,
            owner: draft.owner,
            reviewRequired: review.reviewRequired,
            rolloutScope: draft.rolloutScope,
            rolloutMode: draft.rolloutMode,
            rollbackVersion: draft.rollbackVersion ?? null,
            lintEvidence: draft.lintEvidence,
            evalEvidence: draft.evalEvidence,
            approvalTicketId: draft.approvalTicketId ?? null,
            status: "approved",
            createdAt: nowIso(),
            activatedAt: null,
        };
        this.releases.set(record.releaseId, record);
        return record;
    }
    activate(releaseId) {
        const record = this.requireRelease(releaseId);
        if (record.status !== "approved") {
            throw new Error(`prompt_governance.release_not_approved:${releaseId}`);
        }
        if (record.rolloutMode === "off") {
            throw new Error(`prompt_governance.rollout_mode_inactive:${releaseId}`);
        }
        const activated = {
            ...record,
            status: "active",
            activatedAt: nowIso(),
        };
        this.releases.set(releaseId, activated);
        this.activeReleaseByPromptId.set(record.promptId, releaseId);
        return activated;
    }
    rollback(library, releaseId, rollbackVersion) {
        const record = this.requireRelease(releaseId);
        const targetVersion = rollbackVersion ?? record.rollbackVersion;
        if (targetVersion == null) {
            throw new Error(`prompt_governance.rollback_version_required:${releaseId}`);
        }
        const target = library.prompts.find((item) => item.promptId === record.promptId && item.version === targetVersion);
        if (target == null) {
            throw new Error(`prompt_governance.rollback_target_missing:${targetVersion}`);
        }
        const rolledBack = {
            ...record,
            status: "rolled_back",
        };
        this.releases.set(releaseId, rolledBack);
        if (this.activeReleaseByPromptId.get(record.promptId) === releaseId) {
            this.activeReleaseByPromptId.delete(record.promptId);
        }
        return rolledBack;
    }
    getRelease(releaseId) {
        return this.releases.get(releaseId) ?? null;
    }
    getActiveRelease(promptId) {
        const releaseId = this.activeReleaseByPromptId.get(promptId);
        return releaseId == null ? null : this.releases.get(releaseId) ?? null;
    }
    requireRelease(releaseId) {
        const release = this.releases.get(releaseId);
        if (release == null) {
            throw new Error(`prompt_governance.release_not_found:${releaseId}`);
        }
        return release;
    }
}
//# sourceMappingURL=domain-prompt-governance-service.js.map