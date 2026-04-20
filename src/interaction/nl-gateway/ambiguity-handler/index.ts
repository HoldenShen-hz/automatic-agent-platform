export function detectAmbiguity(message: string, confidence: number, requiredEntityCount = 1, extractedEntityCount = 0): boolean {
  const normalized = message.trim();
  if (normalized.length < 6) {
    return true;
  }
  if (confidence < 0.7) {
    return true;
  }
  return extractedEntityCount < requiredEntityCount;
}
