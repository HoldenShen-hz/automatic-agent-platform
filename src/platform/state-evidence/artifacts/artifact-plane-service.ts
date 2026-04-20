import { ValidationError } from "../../contracts/errors.js";
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

export class ArtifactPlaneService {
  public constructor(
    private readonly bundles: ArtifactBundleService = new ArtifactBundleService(),
    private readonly governance: ArtifactGovernanceService = new ArtifactGovernanceService(),
    private readonly preview: ArtifactPreviewService = new ArtifactPreviewService(),
    private readonly publishService: ArtifactPublishService = new ArtifactPublishService(),
  ) {}

  public prepareBundle(input: {
    taskId: string;
    domainId: string;
    bundleType: ArtifactBundleExtended["bundleType"];
    artifacts: readonly ArtifactRecord[];
    links?: readonly ArtifactLink[];
    finalDeliverables?: readonly string[];
  }): ArtifactPlaneBundleResult {
    const bundle = this.bundles.build(input);
    return {
      bundle,
      governance: this.governance.review(bundle),
      preview: this.preview.renderBundle(bundle),
    };
  }

  public publishBundle(bundle: ArtifactBundleExtended): ArtifactPlaneBundleResult {
    const governance = this.governance.review(bundle);
    if (!governance.allowed) {
      throw new ValidationError("artifact_plane.publish_blocked", "Artifact bundle failed governance review.", {
        category: "validation",
        source: "internal",
        details: { issues: governance.issues, bundleId: bundle.bundleId },
      });
    }
    const published = this.publishService.publish(bundle);
    return {
      bundle: published,
      governance,
      preview: this.preview.renderBundle(published),
    };
  }

  public listPublishHistory(): ArtifactPublishLedgerEntry[] {
    return this.publishService.listPublishHistory();
  }
}
