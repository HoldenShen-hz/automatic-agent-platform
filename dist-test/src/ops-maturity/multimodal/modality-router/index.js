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
export function buildDefaultModalityRoutingTable() {
    return [
        { modality: "text", processor: "text-normalizer", provider: "text_gateway" },
        { modality: "image", processor: "image-processor", provider: "vision_gateway" },
        { modality: "audio", processor: "speech-processor", provider: "speech_gateway" },
        { modality: "document", processor: "document-parser", provider: "document_gateway" },
        { modality: "video", processor: "video-processor", provider: "video_gateway" },
    ];
}
//# sourceMappingURL=index.js.map