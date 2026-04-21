import type { ArtifactLink, ArtifactRecord } from "./artifact-model.js";
import { ArtifactBundleService } from "./artifact-bundle-service.js";
import type { ArtifactBundleExtended } from "./artifact-model.js";
import { ArtifactGovernanceService, type ArtifactGovernanceDecision } from "./artifact-governance-service.js";
import type { ArtifactPublishLedgerEntry } from "./artifact-publish-ledger.js";
import { ArtifactPreviewService } from "./artifact-preview-service.js";
import { ArtifactPublishService } from "./artifact-publish-service.js";
export interface ArtifactPlaneBundleResult {
    bundle: ArtifactBundleExtended;
    governance: ArtifactGovernanceDecision;
    preview: string;
}
export declare class ArtifactPlaneService {
    private readonly bundles;
    private readonly governance;
    private readonly preview;
    private readonly publishService;
    constructor(bundles?: ArtifactBundleService, governance?: ArtifactGovernanceService, preview?: ArtifactPreviewService, publishService?: ArtifactPublishService);
    prepareBundle(input: {
        taskId: string;
        domainId: string;
        bundleType: ArtifactBundleExtended["bundleType"];
        artifacts: readonly ArtifactRecord[];
        links?: readonly ArtifactLink[];
        finalDeliverables?: readonly string[];
    }): ArtifactPlaneBundleResult;
    publishBundle(bundle: ArtifactBundleExtended): ArtifactPlaneBundleResult;
    listPublishHistory(): ArtifactPublishLedgerEntry[];
}
