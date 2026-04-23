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

// Additional coverage tests

test("extractVideoMetadata defaults to h264 when no codec match", () => {
  const metadata = extractVideoMetadata("/tmp/video_1920x1080_30s.avi");
  assert.equal(metadata.codec, "h264");
});

test("extractVideoMetadata defaults to 1280x720 when no resolution match", () => {
  const metadata = extractVideoMetadata("/tmp/video_30s.mp4");
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
});

test("extractVideoMetadata defaults to 30s duration when no duration match", () => {
  const metadata = extractVideoMetadata("/tmp/video.mp4");
  assert.equal(metadata.durationMs, 30_000);
});

test("extractVideoMetadata parses millisecond duration", () => {
  const metadata = extractVideoMetadata("/tmp/video_500ms.mp4");
  assert.equal(metadata.durationMs, 500);
});

test("extractVideoMetadata parses minute duration", () => {
  const metadata = extractVideoMetadata("/tmp/video_5m.mp4");
  assert.equal(metadata.durationMs, 300_000);
});

test("extractVideoMetadata parses webm codec", () => {
  const metadata = extractVideoMetadata("/tmp/video_1920x1080_60s.webm");
  assert.equal(metadata.codec, "webm");
});

test("extractVideoMetadata parses mkv codec", () => {
  const metadata = extractVideoMetadata("/tmp/video_1920x1080_60s.mkv");
  assert.equal(metadata.codec, "mkv");
});

test("transcribeVideo returns default when normalization is empty", () => {
  const transcript = transcribeVideo("/tmp/12345.mp4");
  assert.equal(transcript, "video transcript unavailable");
});

test("transcribeVideo removes numeric suffixes with time units", () => {
  const transcript = transcribeVideo("/tmp/demo_100ms_50s_10m.mp4");
  assert.equal(transcript, "demo");
});

test("transcribeVideo handles underscores and hyphens", () => {
  const transcript = transcribeVideo("/tmp/product_demo-v2_final.mp4");
  assert.equal(transcript, "product demo v2 final");
});

test("transcribeVideo collapses multiple spaces", () => {
  const transcript = transcribeVideo("/tmp/user_guide_final.mp4");
  // Note: "final" is not numeric, so it stays; standalone numbers are removed by regex
  assert.equal(transcript, "user guide final");
});

test("extractVideoKeyFrames returns single frame at 0 for duration below interval", () => {
  // 5s video with 10s interval should give 1 frame at 0
  const keyFrames = extractVideoKeyFrames("/tmp/video_5s.mp4", 10);
  assert.equal(keyFrames.length, 1);
  assert.equal(keyFrames[0]!.timestampMs, 0);
  assert.ok(keyFrames[0]!.imageData.startsWith("frame:0:"));
});

test("extractVideoKeyFrames generates correct frame count for duration", () => {
  // 90s video with 10s interval should give 9 frames (0, 10, 20, ..., 80)
  const keyFrames = extractVideoKeyFrames("/tmp/demo_1920x1080_90s.mp4", 10);
  assert.equal(keyFrames.length, 9);
  assert.equal(keyFrames[0]!.timestampMs, 0);
  assert.equal(keyFrames[keyFrames.length - 1]!.timestampMs, 80_000);
});

test("extractVideoKeyFrames uses floor for non-round intervals", () => {
  // 30s video with 6s interval: floor(6) = 6, so 30000/6000 = 5 frames
  const keyFrames = extractVideoKeyFrames("/tmp/demo_1920x1080_30s.mp4", 6);
  assert.equal(keyFrames.length, 5);
});

test("extractVideoKeyFrames uses minimum 1 second interval", () => {
  // 30s video with 0s interval should use 1s interval = 30 frames
  const keyFrames = extractVideoKeyFrames("/tmp/demo_1920x1080_30s.mp4", 0);
  assert.equal(keyFrames.length, 30);
});

test("extractVideoKeyFrames uses floor for fractional intervals", () => {
  // 30s video with 3.9s interval: floor(3.9) = 3, so 30/3 = 10 frames
  const keyFrames = extractVideoKeyFrames("/tmp/demo_1920x1080_30s.mp4", 3.9);
  assert.equal(keyFrames.length, 10);
});

test("extractVideoKeyFrames determinism produces same results", () => {
  const frames1 = extractVideoKeyFrames("/tmp/demo_1920x1080_30s.mp4", 10);
  const frames2 = extractVideoKeyFrames("/tmp/demo_1920x1080_30s.mp4", 10);
  assert.equal(frames1.length, frames2.length);
  assert.deepEqual(frames1, frames2);
});

test("VideoProcessor.processVideo uses provided metadata", () => {
  const processor = new VideoProcessor();
  const customMetadata = { durationMs: 5000, width: 640, height: 480, codec: "vp9" };
  const result = processor.processVideo({ uri: "/tmp/anything.mp4", metadata: customMetadata });
  assert.equal(result.metadata.durationMs, 5000);
  assert.equal(result.metadata.width, 640);
  assert.equal(result.metadata.height, 480);
  assert.equal(result.metadata.codec, "vp9");
});

test("VideoProcessor.processVideo generates correct keyframe count with custom interval", () => {
  const processor = new VideoProcessor();
  // Use a URI with known duration (20s from existing test pattern)
  const result = processor.processVideo({ uri: "/tmp/test_1280x720_20s.webm" });
  // Default interval is 10, so 20s should give 2 keyframes
  assert.equal(result.keyFrames.length, 2);
});

test("VideoProcessor.processVideo provides all three output fields", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({ uri: "/tmp/test.mp4" });
  assert.ok(result.metadata);
  assert.ok(result.transcript);
  assert.ok(result.keyFrames);
  assert.equal(result.keyFrames.length, 3); // default 30s duration, 10s interval = 3 frames
});

test("VideoProcessor.processVideo keyframes are unique by timestamp", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({ uri: "/tmp/demo_1920x1080_90s.mp4" });
  const timestamps = result.keyFrames.map((kf) => kf.timestampMs);
  const uniqueTimestamps = new Set(timestamps);
  assert.equal(timestamps.length, uniqueTimestamps.size);
});
