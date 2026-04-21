import assert from "node:assert/strict";
import test from "node:test";

import { MultimodalGatewayService } from "../../../../src/ops-maturity/multimodal/multimodal-gateway-service.js";

test("MultimodalGatewayService requires non-empty safety policy reference", () => {
  const service = new MultimodalGatewayService();
  assert.throws(() => {
    service.handle({
      requestId: "req_1",
      modalities: ["text"],
      inputParts: [{ partId: "p1", type: "text", contentRef: "inline", text: "hello" }],
      requestedOutputs: ["summary"],
      safetyPolicyRef: "",
      costBudget: { maxUsd: 1 },
    });
  }, /multimodal_gateway\.safety_policy_required/);
});

test("MultimodalGatewayService requires non-whitespace safety policy reference", () => {
  const service = new MultimodalGatewayService();
  assert.throws(() => {
    service.handle({
      requestId: "req_1",
      modalities: ["text"],
      inputParts: [{ partId: "p1", type: "text", contentRef: "inline", text: "hello" }],
      requestedOutputs: ["summary"],
      safetyPolicyRef: "   ",
      costBudget: { maxUsd: 1 },
    });
  }, /multimodal_gateway\.safety_policy_required/);
});

test("MultimodalGatewayService rejects unsupported modality types", () => {
  const service = new MultimodalGatewayService();
  assert.throws(() => {
    service.handle({
      requestId: "req_1",
      modalities: ["text"],
      inputParts: [{ partId: "p1", type: "video", contentRef: "vid://1" }],
      requestedOutputs: ["summary"],
      safetyPolicyRef: "policy_1",
      costBudget: { maxUsd: 1 },
    });
  }, /multimodal_gateway\.unsupported_modality:video/);
});

test("MultimodalGatewayService rejects parts with modality not declared in request", () => {
  const service = new MultimodalGatewayService();
  assert.throws(() => {
    service.handle({
      requestId: "req_1",
      modalities: ["text"],
      inputParts: [{ partId: "p1", type: "image", contentRef: "img://1" }],
      requestedOutputs: ["summary"],
      safetyPolicyRef: "policy_1",
      costBudget: { maxUsd: 1 },
    });
  }, /multimodal_gateway\.modality_not_declared:image/);
});

test("MultimodalGatewayService processes text input correctly", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_text",
    modalities: ["text"],
    inputParts: [{ partId: "p_text", type: "text", contentRef: "inline", text: "hello world" }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.requestId, "req_text");
  assert.equal(result.routeDecisions.length, 1);
  assert.equal(result.routeDecisions[0]!.partId, "p_text");
  assert.equal(result.routeDecisions[0]!.modality, "text");
  assert.equal(result.routeDecisions[0]!.provider, "text_gateway");
  assert.equal(result.routeDecisions[0]!.processor, "text-normalizer");
  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.01);
  assert.equal(result.blocked, false);
  assert.equal(result.estimatedCostUsd, 0.01);
  assert.equal(result.normalizedInputs.length, 1);
  assert.equal(result.normalizedInputs[0]!.modality, "text");
  assert.equal(result.normalizedInputs[0]!.summary, "text_chars=11");
});

test("MultimodalGatewayService processes image input correctly", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_image",
    modalities: ["image"],
    inputParts: [{
      partId: "p_image",
      type: "image",
      contentRef: "img://1",
      imageMetadata: { width: 1920, height: 1080 },
    }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 1);
  assert.equal(result.routeDecisions[0]!.modality, "image");
  assert.equal(result.routeDecisions[0]!.provider, "vision_gateway");
  assert.equal(result.routeDecisions[0]!.processor, "image-processor");
  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.08);
  assert.equal(result.normalizedInputs[0]!.summary, "image_aspect_ratio=1.7778");
});

test("MultimodalGatewayService processes document input with cost scaling", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_doc",
    modalities: ["document"],
    inputParts: [{
      partId: "p_doc",
      type: "document",
      contentRef: "doc://1",
      documentChunks: ["page1", "page2", "page3"],
    }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 1);
  assert.equal(result.routeDecisions[0]!.modality, "document");
  assert.equal(result.routeDecisions[0]!.provider, "document_gateway");
  assert.equal(result.routeDecisions[0]!.processor, "document-parser");
  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.09);
  assert.equal(result.normalizedInputs[0]!.summary, "document_pages=3");
});

test("MultimodalGatewayService processes audio input with duration estimation", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_audio",
    modalities: ["audio"],
    inputParts: [{
      partId: "p_audio",
      type: "audio",
      contentRef: "audio://1",
      audioSampleCount: 48000,
      audioSampleRate: 16000,
    }],
    requestedOutputs: ["transcript"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 1);
  assert.equal(result.routeDecisions[0]!.modality, "audio");
  assert.equal(result.routeDecisions[0]!.provider, "speech_gateway");
  assert.equal(result.routeDecisions[0]!.processor, "speech-processor");
  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.15);
  assert.equal(result.normalizedInputs[0]!.summary, "audio_duration_ms=3000");
});

test("MultimodalGatewayService blocks restricted data classification", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_restricted",
    modalities: ["text"],
    inputParts: [{
      partId: "p_restricted",
      type: "text",
      contentRef: "inline",
      text: "sensitive data",
      dataClassification: "restricted",
    }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.blocked, true);
  assert.ok(result.safetyFindings.some((f) => f.reasonCode === "multimodal_gateway.restricted_input_blocked"));
  assert.ok(result.safetyFindings.some((f) => f.severity === "high"));
  assert.ok(result.safetyFindings.some((f) => f.blocked === true));
});

test("MultimodalGatewayService blocks image with invalid metadata (zero width)", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_bad_image",
    modalities: ["image"],
    inputParts: [{
      partId: "p_bad_image",
      type: "image",
      contentRef: "img://1",
      imageMetadata: { width: 0, height: 100 },
    }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.blocked, true);
  assert.ok(result.safetyFindings.some((f) => f.reasonCode === "multimodal_gateway.invalid_image_metadata"));
  assert.ok(result.safetyFindings.some((f) => f.severity === "medium"));
});

test("MultimodalGatewayService processes video input correctly", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_video",
    modalities: ["video"],
    inputParts: [{
      partId: "p_video",
      type: "video",
      contentRef: "vid://1",
      videoMetadata: { durationMs: 60000, width: 1920, height: 1080, codec: "h264" },
    }],
    requestedOutputs: ["summary", "transcript"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 1);
  assert.equal(result.routeDecisions[0]!.modality, "video");
  assert.equal(result.routeDecisions[0]!.provider, "video_gateway");
  assert.equal(result.routeDecisions[0]!.processor, "video-processor");
  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.72);
  assert.equal(result.normalizedInputs[0]!.summary, "video_duration_ms=60000,resolution=1920x1080");
});

test("MultimodalGatewayService processes video with zero duration", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_video_zero",
    modalities: ["video"],
    inputParts: [{
      partId: "p_video_zero",
      type: "video",
      contentRef: "vid://empty",
      videoMetadata: { durationMs: 0, width: 0, height: 0, codec: "unknown" },
    }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.12);
  assert.equal(result.normalizedInputs[0]!.summary, "video_duration_ms=0,resolution=0x0");
});

test("MultimodalGatewayService rejects video modality not declared", () => {
  const service = new MultimodalGatewayService();
  assert.throws(() => {
    service.handle({
      requestId: "req_video_not_declared",
      modalities: ["text"],
      inputParts: [{
        partId: "p_video",
        type: "video",
        contentRef: "vid://1",
        videoMetadata: { durationMs: 10000, width: 1280, height: 720, codec: "h264" },
      }],
      requestedOutputs: ["summary"],
      safetyPolicyRef: "policy_1",
      costBudget: { maxUsd: 1 },
    });
  }, /multimodal_gateway\.modality_not_declared:video/);
});

test("MultimodalGatewayService handles mixed modalities including video", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_mixed_video",
    modalities: ["text", "image", "audio", "document", "video"],
    inputParts: [
      { partId: "p_text", type: "text", contentRef: "inline", text: "hello" },
      { partId: "p_image", type: "image", contentRef: "img://1", imageMetadata: { width: 800, height: 600 } },
      { partId: "p_audio", type: "audio", contentRef: "audio://1", audioSampleCount: 16000, audioSampleRate: 8000 },
      { partId: "p_doc", type: "document", contentRef: "doc://1", documentChunks: ["chapter1"] },
      { partId: "p_video", type: "video", contentRef: "vid://1", videoMetadata: { durationMs: 30000, width: 1920, height: 1080, codec: "h264" } },
    ],
    requestedOutputs: ["summary", "transcript"],
    safetyPolicyRef: "policy_mixed",
    costBudget: { maxUsd: 2 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 5);
  assert.equal(result.normalizedInputs.length, 5);
  assert.equal(result.blocked, false);

  const videoDecision = result.routeDecisions.find((r) => r.partId === "p_video");
  assert.equal(videoDecision?.modality, "video");
  assert.equal(videoDecision?.provider, "video_gateway");
  assert.equal(videoDecision?.processor, "video-processor");
  assert.equal(videoDecision?.estimatedCostUsd, 0.12 * 30); // 30 seconds duration
});

test("MultimodalGatewayService blocks when cost budget is exceeded", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_over_budget",
    modalities: ["text", "image", "audio", "document"],
    inputParts: [
      { partId: "p1", type: "text", contentRef: "inline", text: "hello" },
      { partId: "p2", type: "image", contentRef: "img://1", imageMetadata: { width: 100, height: 100 } },
      { partId: "p3", type: "audio", contentRef: "audio://1", audioSampleCount: 48000, audioSampleRate: 16000 },
      { partId: "p4", type: "document", contentRef: "doc://1", documentChunks: ["a", "b", "c"] },
    ],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 0.01 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.blocked, true);
  assert.ok(result.safetyFindings.some((f) => f.reasonCode === "multimodal_gateway.cost_budget_exceeded"));
  assert.ok(result.safetyFindings.some((f) => f.severity === "high"));
  assert.ok(result.safetyFindings.some((f) => f.blocked === true));
});

test("MultimodalGatewayService handles multiple parts with mixed modalities", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_mixed",
    modalities: ["text", "image", "audio", "document"],
    inputParts: [
      { partId: "p_text", type: "text", contentRef: "inline", text: "hello" },
      { partId: "p_image", type: "image", contentRef: "img://1", imageMetadata: { width: 800, height: 600 } },
      { partId: "p_audio", type: "audio", contentRef: "audio://1", audioSampleCount: 16000, audioSampleRate: 8000 },
      { partId: "p_doc", type: "document", contentRef: "doc://1", documentChunks: ["chapter1"] },
    ],
    requestedOutputs: ["summary", "transcript"],
    safetyPolicyRef: "policy_mixed",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions.length, 4);
  assert.equal(result.normalizedInputs.length, 4);
  assert.equal(result.blocked, false);

  const textDecision = result.routeDecisions.find((r) => r.partId === "p_text");
  assert.equal(textDecision?.modality, "text");
  assert.equal(textDecision?.estimatedCostUsd, 0.01);

  const imageDecision = result.routeDecisions.find((r) => r.partId === "p_image");
  assert.equal(imageDecision?.modality, "image");
  assert.equal(imageDecision?.estimatedCostUsd, 0.08);

  const audioDecision = result.routeDecisions.find((r) => r.partId === "p_audio");
  assert.equal(audioDecision?.modality, "audio");
  assert.equal(audioDecision?.estimatedCostUsd, 0.1);

  const docDecision = result.routeDecisions.find((r) => r.partId === "p_doc");
  assert.equal(docDecision?.modality, "document");
  assert.equal(docDecision?.estimatedCostUsd, 0.03);
});

test("MultimodalGatewayService uses provided traceId when available", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_trace",
    modalities: ["text"],
    inputParts: [{ partId: "p1", type: "text", contentRef: "inline", text: "test" }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
    traceId: "custom_trace_123",
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.traceId, "custom_trace_123");
});

test("MultimodalGatewayService generates traceId when not provided", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_no_trace",
    modalities: ["text"],
    inputParts: [{ partId: "p1", type: "text", contentRef: "inline", text: "test" }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.ok(result.traceId.startsWith("trace_"));
});

test("MultimodalGatewayService returns correct createdAt timestamp", () => {
  const service = new MultimodalGatewayService();
  const customTime = "2026-04-21T12:34:56.789Z";
  const result = service.handle({
    requestId: "req_time",
    modalities: ["text"],
    inputParts: [{ partId: "p1", type: "text", contentRef: "inline", text: "test" }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, customTime);

  assert.equal(result.createdAt, customTime);
});

test("MultimodalGatewayService handles document with zero chunks", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_empty_doc",
    modalities: ["document"],
    inputParts: [{
      partId: "p_doc",
      type: "document",
      contentRef: "doc://empty",
      documentChunks: [],
    }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.routeDecisions[0]!.estimatedCostUsd, 0.03);
  assert.equal(result.normalizedInputs[0]!.summary, "document_pages=0");
});

test("MultimodalGatewayService handles audio with zero sample count", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_no_audio",
    modalities: ["audio"],
    inputParts: [{
      partId: "p_audio",
      type: "audio",
      contentRef: "audio://silent",
      audioSampleCount: 0,
      audioSampleRate: 44100,
    }],
    requestedOutputs: ["transcript"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.equal(result.normalizedInputs[0]!.summary, "audio_duration_ms=0");
});

test("MultimodalGatewayService generates valid gatewayRunId", () => {
  const service = new MultimodalGatewayService();
  const result = service.handle({
    requestId: "req_run_id",
    modalities: ["text"],
    inputParts: [{ partId: "p1", type: "text", contentRef: "inline", text: "test" }],
    requestedOutputs: ["summary"],
    safetyPolicyRef: "policy_1",
    costBudget: { maxUsd: 1 },
  }, "2026-04-21T00:00:00.000Z");

  assert.ok(result.gatewayRunId.startsWith("multimodal_run_"));
});
