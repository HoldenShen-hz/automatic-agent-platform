export function estimateSpeechDurationMs(sampleCount: number, sampleRate: number): number {
  if (sampleRate <= 0) {
    return 0;
  }
  return Math.round((sampleCount / sampleRate) * 1000);
}

export interface SpeechAnalysisResult {
  readonly durationMs: number;
  readonly estimatedWords: number;
  readonly transcriptHint: string;
}

export function analyzeSpeech(sampleCount: number, sampleRate: number): SpeechAnalysisResult {
  const durationMs = estimateSpeechDurationMs(sampleCount, sampleRate);
  return {
    durationMs,
    estimatedWords: Math.max(1, Math.round(durationMs / 450)),
    transcriptHint: durationMs === 0 ? "no_audio" : "speech_detected",
  };
}
