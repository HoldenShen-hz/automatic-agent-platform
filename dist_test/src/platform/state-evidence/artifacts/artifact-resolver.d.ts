export interface ArtifactRefBundle {
    artifactRefs: string[];
    primaryRefs: string[];
}
export declare class ArtifactResolver {
    buildBundle(artifactRefs: readonly string[], primaryRefs?: readonly string[]): ArtifactRefBundle;
    resolveRef(artifactRef: string, records: readonly {
        artifactId: string;
    }[]): {
        artifactId: string;
    } | null;
}
