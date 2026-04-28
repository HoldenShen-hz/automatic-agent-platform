import { newId, nowIso } from "../../contracts/types/ids.js";
import type { ArtifactBundleExtended, ArtifactLink, ArtifactRecord } from "./artifact-model.js";

export class ArtifactBundleService {
  public build(input: {
    taskId: string;
    domainId: string;
    bundleType: ArtifactBundleExtended["bundleType"];
    artifacts: readonly ArtifactRecord[];
    links?: readonly ArtifactLink[];
    finalDeliverables?: readonly string[];
  }): ArtifactBundleExtended {
    return {
      bundleId: newId("artifact_bundle"),
      taskId: input.taskId,
      artifacts: [...input.artifacts],
      links: [...(input.links ?? [])],
      finalDeliverables: [...(input.finalDeliverables ?? input.artifacts.map((artifact) => artifact.path || artifact.artifactId))],
      totalSize: input.artifacts.reduce((total, artifact) => total + artifact.size, 0),
      createdAt: nowIso(),
      bundleType: input.bundleType,
      domainId: input.domainId,
      publishStatus: "draft",
      publishedAt: null,
    };
  }
}
