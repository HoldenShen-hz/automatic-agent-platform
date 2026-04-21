export function resolveInputModality(partType) {
    switch (partType) {
        case "text":
        case "image":
        case "audio":
        case "document":
        case "video":
            return partType;
        default:
            return "unsupported";
    }
}
//# sourceMappingURL=index.js.map