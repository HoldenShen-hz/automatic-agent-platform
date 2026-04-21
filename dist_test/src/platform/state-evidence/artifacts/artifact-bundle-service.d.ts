import type { ArtifactBundleExtended, ArtifactLink, ArtifactRecord } from "./artifact-model.js";
export declare class ArtifactBundleService {
    build(input: {
        taskId: string;
        domainId: string;
        bundleType: ArtifactBundleExtended["bundleType"];
        artifacts: readonly ArtifactRecord[];
        links?: readonly ArtifactLink[];
        finalDeliverables?: readonly string[];
    }): ArtifactBundleExtended;
}
