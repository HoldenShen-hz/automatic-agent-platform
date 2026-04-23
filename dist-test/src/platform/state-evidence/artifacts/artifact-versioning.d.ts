import type { ArtifactRecordExtended } from "./artifact-model.js";
export declare class ArtifactVersioningService {
    createNextVersion(previous: ArtifactRecordExtended, overrides: Partial<ArtifactRecordExtended>): ArtifactRecordExtended;
}
