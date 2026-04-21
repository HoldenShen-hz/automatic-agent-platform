import type { ArtifactBundleExtended, ArtifactRecord } from "./artifact-model.js";
export declare class ArtifactPreviewService {
    renderBundle(bundle: ArtifactBundleExtended): string;
    renderArtifact(artifact: ArtifactRecord): string;
    previewDiff(previousContent: string, currentContent: string): string;
    previewJson(value: unknown): string;
    previewMarkdown(markdown: string): string;
}
