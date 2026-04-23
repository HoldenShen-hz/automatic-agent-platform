import assert from "node:assert/strict";
import test from "node:test";
import { estimateSpeechDurationMs, analyzeSpeech, } from "../../../../src/ops-maturity/multimodal/speech-processor/index.js";
test("estimateSpeechDurationMs returns 0 when sampleRate is 0", () => {
    assert.equal(estimateSpeechDurationMs(1000, 0), 0);
});
test("estimateSpeechDurationMs returns 0 when sampleRate is negative", () => {
    assert.equal(estimateSpeechDurationMs(1000, -1), 0);
});
test("estimateSpeechDurationMs calculates correct duration", () => {
    // 16000 samples at 16000 Hz = 1 second = 1000ms
    assert.equal(estimateSpeechDurationMs(16000, 16000), 1000);
});
test("estimateSpeechDurationMs handles fractional sample rates", () => {
    // 1000 samples at 0.5 Hz = 2000 seconds = 2000000ms
    const result = estimateSpeechDurationMs(1000, 0.5);
    assert.equal(result, 2000000);
});
test("estimateSpeechDurationMs rounds to nearest millisecond", () => {
    // 16001 samples at 16000 Hz = 1.0000625 seconds = 1000.0625ms, rounds to 1000
    assert.equal(estimateSpeechDurationMs(16001, 16000), 1000);
});
test("estimateSpeechDurationMs handles large sample counts", () => {
    // 1 million samples at 44100 Hz ≈ 22675.74ms
    const result = estimateSpeechDurationMs(1000000, 44100);
    assert.equal(result, 22676);
});
test("estimateSpeechDurationMs handles very small sample rates", () => {
    // 100 samples at 0.01 Hz = 10000 seconds = 10000000ms
    const result = estimateSpeechDurationMs(100, 0.01);
    assert.equal(result, 10000000);
});
test("estimateSpeechDurationMs returns 0 when sampleCount is 0", () => {
    assert.equal(estimateSpeechDurationMs(0, 16000), 0);
});
test("analyzeSpeech returns correct duration", () => {
    const result = analyzeSpeech(16000, 16000);
    assert.equal(result.durationMs, 1000);
});
test("analyzeSpeech returns estimated words based on duration", () => {
    // 1000ms duration / 450ms per word ≈ 2.22, rounded to 2
    const result = analyzeSpeech(16000, 16000);
    assert.equal(result.estimatedWords, 2);
});
test("analyzeSpeech returns at least 1 word", () => {
    // Very short audio should still return at least 1 word
    const result = analyzeSpeech(1000, 16000); // ~62.5ms
    assert.ok(result.estimatedWords >= 1);
});
test("analyzeSpeech returns speech_detected hint for non-zero duration", () => {
    const result = analyzeSpeech(16000, 16000);
    assert.equal(result.transcriptHint, "speech_detected");
});
test("analyzeSpeech returns no_audio hint for zero duration", () => {
    const result = analyzeSpeech(0, 16000);
    assert.equal(result.transcriptHint, "no_audio");
});
test("analyzeSpeech returns no_audio hint for zero sample rate", () => {
    const result = analyzeSpeech(16000, 0);
    assert.equal(result.transcriptHint, "no_audio");
});
test("analyzeSpeech handles typical audio sample rate 44100", () => {
    // 44100 samples at 44100 Hz = 1 second
    const result = analyzeSpeech(44100, 44100);
    assert.equal(result.durationMs, 1000);
    assert.equal(result.estimatedWords, 2);
});
test("analyzeSpeech handles telephony sample rate 8000", () => {
    // 8000 samples at 8000 Hz = 1 second
    const result = analyzeSpeech(8000, 8000);
    assert.equal(result.durationMs, 1000);
    assert.equal(result.estimatedWords, 2);
});
test("analyzeSpeech long audio gives correct word count", () => {
    // 5 minutes of audio at 44100 Hz = 300000 samples
    // duration = 300000/44100 * 1000 ≈ 6802ms
    // words = 6802/450 ≈ 15
    const result = analyzeSpeech(13230000, 44100);
    assert.ok(result.estimatedWords >= 10);
});
//# sourceMappingURL=speech-processor.test.js.map