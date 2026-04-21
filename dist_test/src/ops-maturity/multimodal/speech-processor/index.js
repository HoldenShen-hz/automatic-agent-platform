export function estimateSpeechDurationMs(sampleCount, sampleRate) {
    if (sampleRate <= 0) {
        return 0;
    }
    return Math.round((sampleCount / sampleRate) * 1000);
}
//# sourceMappingURL=index.js.map