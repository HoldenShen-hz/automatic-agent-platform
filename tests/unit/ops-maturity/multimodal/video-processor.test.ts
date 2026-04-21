import assert from "node:assert/strict";
import test from "node:test";

import {
  extractVideoMetadata,
  extractVideoKeyFrames,
  transcribeVideo,
  VideoProcessor,
} from "../../../../src/ops-maturity/multimodal/video-processor/index.js";

test("video processor derives metadata from URI naming convention", () => {
  const metadata = extractVideoMetadata("/tmp/demo_1920x1080_90s.mp4");
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  assert.equal(metadata.durationMs, 90_000);
  assert.equal(metadata.codec, "mp4");
});

test("video processor derives transcript and keyframes deterministically", () => {
  const transcript = transcribeVideo("/tmp/release_review_30s.mov");
  assert.match(transcript, /release review/);

  const keyFrames = extractVideoKeyFrames("/tmp/release_review_30s.mov", 10);
  assert.equal(keyFrames.length, 3);
  assert.ok(keyFrames[0]!.imageData.startsWith("frame:0:"));
});

test("VideoProcessor.processVideo combines metadata transcript and frames", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({ uri: "/tmp/incident_walkthrough_1280x720_20s.webm" });
  assert.equal(result.metadata.width, 1280);
  assert.equal(result.keyFrames.length, 2);
  assert.match(result.transcript, /incident walkthrough/);
});
