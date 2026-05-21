import assert from "node:assert/strict";
import test from "node:test";

import {
  extractVideoKeyFrames,
  extractVideoMetadata,
  extractVideoTranscriptSegments,
  transcribeVideo,
  VideoProcessor,
} from "../../../../src/ops-maturity/multimodal/video-processor/index.js";

test("[ARCH-P1-7] video processor performs actual processing beyond stub", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({ uri: "/tmp/incident_walkthrough_scenes3_1280x720_30s.webm" });

  assert.ok(result.keyFrames, "Video processor must extract frames");
  assert.ok(result.keyFrames.length > 0, "Must produce at least one frame");
  assert.ok(result.metadata, "Must produce metadata");
  assert.ok(result.transcript !== undefined, "Must produce transcript");
});

test("[ARCH-P1-7] video processor handles different video formats", () => {
  const processor = new VideoProcessor();
  const mp4Result = processor.processVideo({ uri: "/tmp/demo_1920x1080_90s_60fps_2ch.mp4" });
  const movResult = processor.processVideo({ uri: "/tmp/release_review_customer_escalation_30s.mov" });
  const webmResult = processor.processVideo({ uri: "/tmp/incident_walkthrough_scenes3_1280x720_45s.webm" });
  const aviResult = processor.processVideo({ uri: "/tmp/video.avi" });

  assert.equal(mp4Result.metadata.codec, "mp4", "mp4 codec must be recognized");
  assert.equal(movResult.metadata.codec, "mov", "mov codec must be recognized");
  assert.equal(webmResult.metadata.codec, "webm", "webm codec must be recognized");
  assert.equal(aviResult.metadata.codec, "h264", "avi codec must normalize to h264");
});

test("[ARCH-P1-7] video processor produces non-empty output", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({ uri: "/tmp/incident_walkthrough_scenes3_1280x720_30s.webm" });

  assert.ok(result.metadata, "Must produce metadata");
  assert.ok(result.metadata.durationMs > 0, "Duration must be positive");
  assert.ok(result.transcript !== undefined, "Must produce transcript");
  assert.ok(result.transcriptSegments !== undefined, "Must produce transcript segments");
  assert.ok(result.scenes !== undefined, "Must produce scenes");
  assert.ok(result.scenes.length > 0, "Must produce at least one scene");
  assert.ok(result.keyFrames !== undefined, "Must produce keyframes");
  assert.ok(result.keyFrames.length > 0, "Must produce at least one keyframe");
  assert.ok(result.qualityAssessment !== undefined, "Must produce quality assessment");
  assert.ok(result.qualityAssessment.reasonCodes !== undefined, "Must produce reason codes");
});