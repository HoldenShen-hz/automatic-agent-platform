import { newId } from "../../contracts/types/ids.js";
import type { ArtifactLinkExtended } from "./artifact-model.js";

export class ArtifactLinkageService {
  private readonly links = new Map<string, ArtifactLinkExtended>();

  public link(fromArtifactId: string, toRefId: string, relation: ArtifactLinkExtended["relation"]): ArtifactLinkExtended {
    const link: ArtifactLinkExtended = {
      linkId: newId("artifact_link"),
      fromArtifactId,
      toRefId,
      relation,
    };
    this.links.set(link.linkId, link);
    return link;
  }

  public listForArtifact(artifactId: string): ArtifactLinkExtended[] {
    return [...this.links.values()].filter((link) => link.fromArtifactId === artifactId);
  }
}
