export function estimateSpeechDurationMs(sampleCount, sampleRate) {
    if (sampleRate <= 0) {
        return 0;
    }
    return Math.round((sampleCount / sampleRate) * 1000);
}
export function analyzeSpeech(sampleCount, sampleRate) {
    const durationMs = estimateSpeechDurationMs(sampleCount, sampleRate);
    return {
        durationMs,
        estimatedWords: Math.max(1, Math.round(durationMs / 450)),
        transcriptHint: durationMs === 0 ? "no_audio" : "speech_detected",
    };
}
//# sourceMappingURL=index.js.map