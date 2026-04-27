import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateSpeechDurationMs,
  analyzeSpeech,
} from "../../../../../src/ops-maturity/multimodal/speech-processor/index.js";

test("estimateSpeechDurationMs calculates duration from sample count and rate", () => {
  assert.equal(estimateSpeechDurationMs(16000, 16_000), 1000);
  assert.equal(estimateSpeechDurationMs(8000, 8000), 1000);
  assert.equal(estimateSpeechDurationMs(48000, 16000), 3000);
});

test("estimateSpeechDurationMs returns 0 when sampleRate is zero", () => {
  assert.equal(estimateSpeechDurationMs(1000, 0), 0);
});

test("estimateSpeechDurationMs returns 0 when sampleRate is negative", () => {
  assert.equal(estimateSpeechDurationMs(1000, -1), 0);
});

test("analyzeSpeech returns no_audio hint when duration is zero", () => {
  const result = analyzeSpeech(0, 44100);
  assert.equal(result.transcriptHint, "no_audio");
  assert.equal(result.durationMs, 0);
  assert.equal(result.estimatedWords, 1);
});

test("analyzeSpeech returns speech_detected hint when audio present", () => {
  const result = analyzeSpeech(16000, 16000);
  assert.equal(result.transcriptHint, "speech_detected");
  assert.equal(result.durationMs, 1000);
  assert.equal(result.estimatedWords, Math.round(1000 / 450));
});

test("analyzeSpeech estimatedWords minimum is 1", () => {
  const result = analyzeSpeech(1000, 16000);
  assert.equal(result.estimatedWords, 1);
});

test("analyzeSpeech durationMs matches estimateSpeechDurationMs", () => {
  const samples = 32000;
  const rate = 16000;
  const result = analyzeSpeech(samples, rate);
  assert.equal(result.durationMs, estimateSpeechDurationMs(samples, rate));
});
