import type { ArtifactRecordExtended } from "./artifact-model.js";

export class ArtifactVersioningService {
  public createNextVersion(previous: ArtifactRecordExtended, overrides: Partial<ArtifactRecordExtended>): ArtifactRecordExtended {
    return {
      ...previous,
      ...overrides,
      version: previous.version + 1,
      parentArtifactId: previous.artifactId,
    };
  }
}
