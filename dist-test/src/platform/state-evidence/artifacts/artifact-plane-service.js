import { ValidationError } from "../../contracts/errors.js";
import { ArtifactBundleService } from "./artifact-bundle-service.js";
import { ArtifactGovernanceService } from "./artifact-governance-service.js";
import { ArtifactPreviewService } from "./artifact-preview-service.js";
import { ArtifactPublishService } from "./artifact-publish-service.js";
export class ArtifactPlaneService {
    bundles;
    governance;
    preview;
    publishService;
    constructor(bundles = new ArtifactBundleService(), governance = new ArtifactGovernanceService(), preview = new ArtifactPreviewService(), publishService = new ArtifactPublishService()) {
        this.bundles = bundles;
        this.governance = governance;
        this.preview = preview;
        this.publishService = publishService;
    }
    prepareBundle(input) {
        const bundle = this.bundles.build(input);
        return {
            bundle,
            governance: this.governance.review(bundle),
            preview: this.preview.renderBundle(bundle),
        };
    }
    publishBundle(bundle) {
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
    listPublishHistory() {
        return this.publishService.listPublishHistory();
    }
}
//# sourceMappingURL=artifact-plane-service.js.map