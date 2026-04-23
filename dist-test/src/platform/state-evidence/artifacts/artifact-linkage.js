import { newId } from "../../contracts/types/ids.js";
export class ArtifactLinkageService {
    links = new Map();
    link(fromArtifactId, toRefId, relation) {
        const link = {
            linkId: newId("artifact_link"),
            fromArtifactId,
            toRefId,
            relation,
        };
        this.links.set(link.linkId, link);
        return link;
    }
    listForArtifact(artifactId) {
        return [...this.links.values()].filter((link) => link.fromArtifactId === artifactId);
    }
}
//# sourceMappingURL=artifact-linkage.js.map