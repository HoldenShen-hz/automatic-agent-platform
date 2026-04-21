import type { ArtifactLinkExtended } from "./artifact-model.js";
export declare class ArtifactLinkageService {
    private readonly links;
    link(fromArtifactId: string, toRefId: string, relation: ArtifactLinkExtended["relation"]): ArtifactLinkExtended;
    listForArtifact(artifactId: string): ArtifactLinkExtended[];
}
