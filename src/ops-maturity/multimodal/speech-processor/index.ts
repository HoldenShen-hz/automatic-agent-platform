export function estimateSpeechDurationMs(sampleCount: number, sampleRate: number): number {
  if (sampleRate <= 0) {
    return 0;
  }
  return Math.round((sampleCount / sampleRate) * 1000);
}
