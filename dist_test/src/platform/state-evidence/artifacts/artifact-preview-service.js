function renderArtifactPreview(artifact) {
    return `- ${artifact.artifactId} [${artifact.type}] ${artifact.path} v${artifact.version}`;
}
function summarizeJson(value, indent = 0) {
    const prefix = "  ".repeat(indent);
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => [`${prefix}- [${index}]`, ...summarizeJson(item, indent + 1)]);
    }
    if (value != null && typeof value === "object") {
        return Object.entries(value)
            .flatMap(([key, item]) => [`${prefix}- ${key}`, ...summarizeJson(item, indent + 1)]);
    }
    return [`${prefix}- ${String(value)}`];
}
function buildUnifiedDiff(previous, current) {
    const previousLines = previous.split("\n");
    const currentLines = current.split("\n");
    const maxLength = Math.max(previousLines.length, currentLines.length);
    const diffLines = ["--- previous", "+++ current", "@@"];
    for (let index = 0; index < maxLength; index += 1) {
        const before = previousLines[index];
        const after = currentLines[index];
        if (before === after) {
            if (before != null) {
                diffLines.push(` ${before}`);
            }
            continue;
        }
        if (before != null) {
            diffLines.push(`-${before}`);
        }
        if (after != null) {
            diffLines.push(`+${after}`);
        }
    }
    return diffLines.join("\n");
}
export class ArtifactPreviewService {
    renderBundle(bundle) {
        return [
            `# Artifact Bundle ${bundle.bundleId}`,
            `- domain: ${bundle.domainId}`,
            `- status: ${bundle.publishStatus}`,
            "",
            "## Artifacts",
            ...bundle.artifacts.map((artifact) => renderArtifactPreview(artifact)),
            "",
            "## Deliverables",
            ...bundle.finalDeliverables.map((deliverable) => `- ${deliverable}`),
        ].join("\n");
    }
    renderArtifact(artifact) {
        return [
            `# Artifact ${artifact.artifactId}`,
            `- type: ${artifact.type}`,
            `- path: ${artifact.path}`,
            `- version: ${artifact.version}`,
            `- status: ${artifact.status}`,
        ].join("\n");
    }
    previewDiff(previousContent, currentContent) {
        return buildUnifiedDiff(previousContent, currentContent);
    }
    previewJson(value) {
        return [
            "# JSON Preview",
            "```json",
            JSON.stringify(value, null, 2),
            "```",
            "",
            "## Tree",
            ...summarizeJson(value),
        ].join("\n");
    }
    previewMarkdown(markdown) {
        const headings = markdown
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => /^#+\s+/.test(line))
            .map((line) => `- ${line.replace(/^#+\s+/, "")}`);
        return [
            "# Markdown Preview",
            ...(headings.length > 0 ? ["## Headings", ...headings, ""] : []),
            "## Raw",
            markdown,
        ].join("\n");
    }
}
//# sourceMappingURL=artifact-preview-service.js.map