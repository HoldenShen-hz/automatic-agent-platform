export function normalizeImageAspectRatio(metadata) {
    if (metadata.height === 0) {
        return 0;
    }
    return Number((metadata.width / metadata.height).toFixed(4));
}
export function analyzeImage(metadata) {
    const aspectRatio = normalizeImageAspectRatio(metadata);
    return {
        aspectRatio,
        orientation: metadata.width === metadata.height ? "square" : metadata.width > metadata.height ? "landscape" : "portrait",
        containsText: metadata.containsText ?? false,
    };
}
//# sourceMappingURL=index.js.map