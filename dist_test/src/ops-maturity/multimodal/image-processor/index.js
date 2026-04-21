export function normalizeImageAspectRatio(metadata) {
    if (metadata.height === 0) {
        return 0;
    }
    return Number((metadata.width / metadata.height).toFixed(4));
}
//# sourceMappingURL=index.js.map