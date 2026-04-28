import assert from "node:assert/strict";
import test from "node:test";

import { MultimodalGatewayService, VideoProcessor } from "../../../src/ops-maturity/multimodal/index.js";

test("integration: multimodal video pipeline materializes transcript scenes keyframes and gateway summary", () => {
  const videoProcessor = new VideoProcessor();
  const processed = videoProcessor.processVideo({
    uri: "/tmp/operator_handoff_scenes3_1920x1080_45s_60fps.mp4",
  });

  assert.equal(processed.metadata.frameRate, 60);
  assert.equal(processed.scenes.length, 3);
  assert.equal(processed.transcriptSegments.length, 1);
  assert.equal(processed.keyFrames.length, 5);
  assert.equal(processed.qualityAssessment.readiness, "ready");

  const gateway = new MultimodalGatewayService(videoProcessor);
  const gatewayResult = gateway.handle({
    requestId: "mm_video_pipeline",
    modalities: ["video"],
    inputParts: [
      {
        partId: "video_1",
        type: "video",
        contentRef: "/tmp/operator_handoff_scenes3_1920x1080_45s_60fps.mp4",
        mimeType: "video/mp4",
      },
    ],
    requestedOutputs: ["summary", "transcript"],
    safetyPolicyRef: "policy.multimodal.video",
    costBudget: { maxUsd: 10 },
  }, "2026-04-23T00:00:00.000Z");

  assert.equal(gatewayResult.blocked, false);
  assert.equal(gatewayResult.routeDecisions.length, 1);
  assert.equal(
    gatewayResult.normalizedInputs[0]!.summary,
    "video_duration_ms=45000,resolution=1920x1080,scenes=3,transcript_segments=1,quality=ready",
  );
});
