export class ArtifactResolver {
    buildBundle(artifactRefs, primaryRefs = []) {
        const unique = (values) => Array.from(new Set(values));
        return {
            artifactRefs: unique(artifactRefs),
            primaryRefs: unique(primaryRefs.length > 0 ? primaryRefs : artifactRefs),
        };
    }
    resolveRef(artifactRef, records) {
        const artifactId = artifactRef.startsWith("artifact:") ? artifactRef.slice("artifact:".length) : artifactRef;
        return records.find((record) => record.artifactId === artifactId) ?? null;
    }
}
//# sourceMappingURL=artifact-resolver.js.map