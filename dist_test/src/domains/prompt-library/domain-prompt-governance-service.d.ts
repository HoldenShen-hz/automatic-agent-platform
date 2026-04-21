import { type DomainPromptLibrary } from "./index.js";
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
export declare class DomainPromptGovernanceService {
    private readonly releases;
    private readonly activeReleaseByPromptId;
    review(library: DomainPromptLibrary, promptId: string): PromptReviewSummary;
    proposeRelease(library: DomainPromptLibrary, draft: PromptReleaseDraft): PromptReleaseRecord;
    activate(releaseId: string): PromptReleaseRecord;
    rollback(library: DomainPromptLibrary, releaseId: string, rollbackVersion?: string): PromptReleaseRecord;
    getRelease(releaseId: string): PromptReleaseRecord | null;
    getActiveRelease(promptId: string): PromptReleaseRecord | null;
    private requireRelease;
}
