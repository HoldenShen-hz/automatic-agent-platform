export class ArtifactVersioningService {
    createNextVersion(previous, overrides) {
        return {
            ...previous,
            ...overrides,
            version: previous.version + 1,
            parentArtifactId: previous.artifactId,
        };
    }
}
//# sourceMappingURL=artifact-versioning.js.map