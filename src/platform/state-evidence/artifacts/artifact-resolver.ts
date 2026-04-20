export interface ArtifactRefBundle {
  artifactRefs: string[];
  primaryRefs: string[];
}

export class ArtifactResolver {
  public buildBundle(artifactRefs: readonly string[], primaryRefs: readonly string[] = []): ArtifactRefBundle {
    const unique = (values: readonly string[]) => Array.from(new Set(values));
    return {
      artifactRefs: unique(artifactRefs),
      primaryRefs: unique(primaryRefs.length > 0 ? primaryRefs : artifactRefs),
    };
  }

  public resolveRef(artifactRef: string, records: readonly { artifactId: string }[]): { artifactId: string } | null {
    const artifactId = artifactRef.startsWith("artifact:") ? artifactRef.slice("artifact:".length) : artifactRef;
    return records.find((record) => record.artifactId === artifactId) ?? null;
  }
}
