import { newId, nowIso } from "../../contracts/types/ids.js";
export class ArtifactBundleService {
    build(input) {
        return {
            bundleId: newId("artifact_bundle"),
            taskId: input.taskId,
            artifacts: [...input.artifacts],
            links: [...(input.links ?? [])],
            finalDeliverables: [...(input.finalDeliverables ?? input.artifacts.map((artifact) => artifact.artifactId))],
            totalSize: input.artifacts.reduce((total, artifact) => total + artifact.size, 0),
            createdAt: nowIso(),
            bundleType: input.bundleType,
            domainId: input.domainId,
            publishStatus: "draft",
            publishedAt: null,
        };
    }
}
//# sourceMappingURL=artifact-bundle-service.js.map