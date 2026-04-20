import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { resolvePromptTemplate, type DomainPromptLibrary } from "./index.js";

export type PromptRolloutMode = "off" | "suggest" | "shadow";
export type PromptReleaseStatus = "draft" | "approved" | "active" | "rolled_back";

export interface PromptReviewSummary {
  readonly promptId: string;
  readonly domainId: string;
  readonly version: string;
  readonly stage: string;
  readonly guardrails: readonly string[];
  readonly reviewRequired: boolean;
  readonly cacheSegments: readonly ("fixed_prefix" | "domain_block" | "variable_suffix")[];
}

export interface PromptReleaseDraft {
  readonly promptId: string;
  readonly owner: string;
  readonly rolloutScope: readonly string[];
  readonly rolloutMode: PromptRolloutMode;
  readonly lintEvidence: readonly string[];
  readonly evalEvidence: readonly string[];
  readonly approvalTicketId?: string;
  readonly rollbackVersion?: string;
}

export interface PromptReleaseRecord {
  readonly releaseId: string;
  readonly promptId: string;
  readonly domainId: string;
  readonly version: string;
  readonly owner: string;
  readonly reviewRequired: boolean;
  readonly rolloutScope: readonly string[];
  readonly rolloutMode: PromptRolloutMode;
  readonly rollbackVersion: string | null;
  readonly lintEvidence: readonly string[];
  readonly evalEvidence: readonly string[];
  readonly approvalTicketId: string | null;
  readonly status: PromptReleaseStatus;
  readonly createdAt: string;
  readonly activatedAt: string | null;
}

export class DomainPromptGovernanceService {
  private readonly releases = new Map<string, PromptReleaseRecord>();
  private readonly activeReleaseByPromptId = new Map<string, string>();

  public review(library: DomainPromptLibrary, promptId: string): PromptReviewSummary {
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

  public proposeRelease(library: DomainPromptLibrary, draft: PromptReleaseDraft): PromptReleaseRecord {
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
    const record: PromptReleaseRecord = {
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

  public activate(releaseId: string): PromptReleaseRecord {
    const record = this.requireRelease(releaseId);
    if (record.status !== "approved") {
      throw new Error(`prompt_governance.release_not_approved:${releaseId}`);
    }
    if (record.rolloutMode === "off") {
      throw new Error(`prompt_governance.rollout_mode_inactive:${releaseId}`);
    }

    const activated: PromptReleaseRecord = {
      ...record,
      status: "active",
      activatedAt: nowIso(),
    };
    this.releases.set(releaseId, activated);
    this.activeReleaseByPromptId.set(record.promptId, releaseId);
    return activated;
  }

  public rollback(library: DomainPromptLibrary, releaseId: string, rollbackVersion?: string): PromptReleaseRecord {
    const record = this.requireRelease(releaseId);
    const targetVersion = rollbackVersion ?? record.rollbackVersion;
    if (targetVersion == null) {
      throw new Error(`prompt_governance.rollback_version_required:${releaseId}`);
    }
    const target = library.prompts.find((item) => item.promptId === record.promptId && item.version === targetVersion);
    if (target == null) {
      throw new Error(`prompt_governance.rollback_target_missing:${targetVersion}`);
    }

    const rolledBack: PromptReleaseRecord = {
      ...record,
      status: "rolled_back",
    };
    this.releases.set(releaseId, rolledBack);
    if (this.activeReleaseByPromptId.get(record.promptId) === releaseId) {
      this.activeReleaseByPromptId.delete(record.promptId);
    }
    return rolledBack;
  }

  public getRelease(releaseId: string): PromptReleaseRecord | null {
    return this.releases.get(releaseId) ?? null;
  }

  public getActiveRelease(promptId: string): PromptReleaseRecord | null {
    const releaseId = this.activeReleaseByPromptId.get(promptId);
    return releaseId == null ? null : this.releases.get(releaseId) ?? null;
  }

  private requireRelease(releaseId: string): PromptReleaseRecord {
    const release = this.releases.get(releaseId);
    if (release == null) {
      throw new Error(`prompt_governance.release_not_found:${releaseId}`);
    }
    return release;
  }
}
