export function detectAmbiguity(message, confidence, requiredEntityCount = 1, extractedEntityCount = 0) {
    const normalized = message.trim();
    if (normalized.length < 6) {
        return true;
    }
    if (confidence < 0.7) {
        return true;
    }
    return extractedEntityCount < requiredEntityCount;
}
//# sourceMappingURL=index.js.map