import type { ArtifactBundleExtended } from "./artifact-model.js";
import { ArtifactPublishLedger, type ArtifactPublishLedgerEntry } from "./artifact-publish-ledger.js";
export type ArtifactPublishTarget = "git" | "notion" | "cdn";
export interface ArtifactPublishResult {
    bundle: ArtifactBundleExtended;
    target: ArtifactPublishTarget;
    destination: string;
    publishedArtifactIds: string[];
    metadata: Record<string, unknown>;
}
export declare class ArtifactPublishService {
    private readonly ledger;
    constructor(ledger?: ArtifactPublishLedger);
    publish(bundle: ArtifactBundleExtended): ArtifactBundleExtended;
    publishWithMetadata(bundle: ArtifactBundleExtended): ArtifactPublishResult;
    publishToGit(bundle: ArtifactBundleExtended, input: {
        repository: string;
        branch?: string;
        commitMessage?: string;
    }): ArtifactPublishResult;
    publishToNotion(bundle: ArtifactBundleExtended, input: {
        parentPageId: string;
        pageTitle?: string;
    }): ArtifactPublishResult;
    publishToCdn(bundle: ArtifactBundleExtended, input: {
        baseUrl: string;
        pathPrefix?: string;
    }): ArtifactPublishResult;
    listPublishHistory(): ArtifactPublishLedgerEntry[];
    private createPublishedBundle;
}
