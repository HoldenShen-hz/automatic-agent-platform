import assert from "node:assert/strict";
import test from "node:test";

import {
  assessVideoQuality,
  detectVideoScenes,
  extractVideoKeyFrames,
  extractVideoMetadata,
  extractVideoTranscriptSegments,
  transcribeVideo,
  VideoProcessor,
} from "../../../../src/ops-maturity/multimodal/video-processor/index.js";

test("video processor derives media metadata from URI naming convention", () => {
  const metadata = extractVideoMetadata("/tmp/demo_1920x1080_90s_60fps_2ch.mp4");
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  assert.equal(metadata.durationMs, 90_000);
  assert.equal(metadata.codec, "mp4");
  assert.equal(metadata.frameRate, 60);
  assert.equal(metadata.audioChannels, 2);
});

test("video processor derives transcript segments with stable timestamps", () => {
  const metadata = extractVideoMetadata("/tmp/release_review_customer_escalation_30s.mov");
  const segments = extractVideoTranscriptSegments("/tmp/release_review_customer_escalation_30s.mov", metadata);
  assert.equal(segments.length, 1);
  assert.equal(segments[0]!.startMs, 0);
  assert.equal(segments[0]!.endMs, 30_000);
  assert.match(segments[0]!.text, /release review customer escalation/);
  assert.equal(segments[0]!.confidence, 0.82);
});

test("video processor detects scenes from explicit scene count hint", () => {
  const metadata = extractVideoMetadata("/tmp/incident_walkthrough_scenes3_1280x720_45s.webm");
  const segments = extractVideoTranscriptSegments("/tmp/incident_walkthrough_scenes3_1280x720_45s.webm", metadata);
  const scenes = detectVideoScenes("/tmp/incident_walkthrough_scenes3_1280x720_45s.webm", metadata, segments);
  assert.equal(scenes.length, 3);
  assert.deepEqual(scenes.map((scene) => scene.sceneId), ["scene_1", "scene_2", "scene_3"]);
  assert.equal(scenes[0]!.startMs, 0);
  assert.equal(scenes[2]!.endMs, 45_000);
  assert.ok(scenes[0]!.dominantKeywords.length > 0);
});

test("video processor keyframes are scene-aware while preserving deterministic frame IDs", () => {
  const metadata = extractVideoMetadata("/tmp/incident_walkthrough_scenes3_1280x720_30s.webm");
  const scenes = detectVideoScenes("/tmp/incident_walkthrough_scenes3_1280x720_30s.webm", metadata);
  const keyFrames = extractVideoKeyFrames("/tmp/incident_walkthrough_scenes3_1280x720_30s.webm", 10, metadata, scenes);
  assert.equal(keyFrames.length, 3);
  assert.equal(keyFrames[0]!.sceneId, "scene_1");
  assert.ok(keyFrames[0]!.imageData.startsWith("frame:0:"));
  assert.equal(keyFrames[1]!.timestampMs, 10_000);
});

test("VideoProcessor.processVideo materializes full structured video pipeline", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({ uri: "/tmp/incident_walkthrough_scenes3_1280x720_30s.webm" });
  assert.equal(result.metadata.width, 1280);
  assert.equal(result.scenes.length, 3);
  assert.equal(result.keyFrames.length, 3);
  assert.equal(result.qualityAssessment.readiness, "ready");
  assert.equal(result.qualityAssessment.sceneCount, 3);
  assert.equal(result.qualityAssessment.keyFrameCount, 3);
  assert.match(result.transcript, /incident walkthrough/);
});

test("VideoProcessor.processVideo uses provided metadata and marks invalid video readiness", () => {
  const processor = new VideoProcessor();
  const result = processor.processVideo({
    uri: "/tmp/empty_capture.mp4",
    metadata: { durationMs: 0, width: 0, height: 0, codec: "unknown" },
  });
  assert.equal(result.metadata.durationMs, 0);
  assert.equal(result.keyFrames.length, 1);
  assert.equal(result.qualityAssessment.readiness, "blocked");
  assert.ok(result.qualityAssessment.reasonCodes.includes("video_processor.zero_duration"));
  assert.ok(result.qualityAssessment.reasonCodes.includes("video_processor.invalid_resolution"));
});

test("assessVideoQuality returns conditional when transcript evidence is unavailable", () => {
  const metadata = { durationMs: 5_000, width: 640, height: 480, codec: "mp4" };
  const keyFrames = extractVideoKeyFrames("/tmp/12345.mp4", 10, metadata);
  const quality = assessVideoQuality({
    metadata,
    transcriptSegments: [],
    scenes: [],
    keyFrames,
  });
  assert.equal(quality.readiness, "conditional");
  assert.equal(quality.hasSpeech, false);
  assert.ok(quality.reasonCodes.includes("video_processor.no_transcript_segments"));
});

test("transcribeVideo still returns deterministic fallback for non-semantic filenames", () => {
  const transcript = transcribeVideo("/tmp/12345.mp4");
  assert.equal(transcript, "video transcript unavailable");
});

test("extractVideoMetadata defaults safely when naming hints are missing", () => {
  const metadata = extractVideoMetadata("/tmp/video.avi");
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
  assert.equal(metadata.durationMs, 30_000);
  assert.equal(metadata.codec, "h264");
});

test("extractVideoKeyFrames uses minimum one second interval", () => {
  const keyFrames = extractVideoKeyFrames("/tmp/demo_1920x1080_30s.mp4", 0);
  assert.equal(keyFrames.length, 30);
  assert.equal(keyFrames[keyFrames.length - 1]!.timestampMs, 29_000);
});
