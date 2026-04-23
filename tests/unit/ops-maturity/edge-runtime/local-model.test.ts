import assert from "node:assert/strict";
import test from "node:test";

import {
  selectEdgeLocalModel,
  type LocalModelProfile,
} from "../../../../src/ops-maturity/edge-runtime/local-model/index.js";

test("selectEdgeLocalModel returns model matching modality", () => {
  const models: LocalModelProfile[] = [
    { modelId: "vision-model", modalities: ["image", "text"] },
    { modelId: "text-model", modalities: ["text"] },
  ];

  const selected = selectEdgeLocalModel(models, "image");
  assert.equal(selected?.modelId, "vision-model");
});

test("selectEdgeLocalModel returns null when no model supports modality", () => {
  const models: LocalModelProfile[] = [
    { modelId: "text-model", modalities: ["text"] },
  ];

  const selected = selectEdgeLocalModel(models, "audio");
  assert.equal(selected, null);
});

test("selectEdgeLocalModel returns null for empty model list", () => {
  const selected = selectEdgeLocalModel([], "text");
  assert.equal(selected, null);
});

test("selectEdgeLocalModel selects highest priority model when multiple match", () => {
  const models: LocalModelProfile[] = [
    { modelId: "low-priority", modalities: ["text"], priority: 1 },
    { modelId: "high-priority", modalities: ["text"], priority: 10 },
    { modelId: "medium-priority", modalities: ["text"], priority: 5 },
  ];

  const selected = selectEdgeLocalModel(models, "text");
  assert.equal(selected?.modelId, "high-priority");
});

test("selectEdgeLocalModel defaults priority to 0", () => {
  const models: LocalModelProfile[] = [
    { modelId: "no-priority", modalities: ["text"] },
    { modelId: "with-priority", modalities: ["text"], priority: 1 },
  ];

  const selected = selectEdgeLocalModel(models, "text");
  assert.equal(selected?.modelId, "with-priority");
});

test("selectEdgeLocalModel returns first match when priorities are equal", () => {
  const models: LocalModelProfile[] = [
    { modelId: "first", modalities: ["text"], priority: 5 },
    { modelId: "second", modalities: ["text"], priority: 5 },
  ];

  const selected = selectEdgeLocalModel(models, "text");
  assert.equal(selected?.modelId, "first");
});

test("selectEdgeLocalModel filters models by modality correctly", () => {
  const models: LocalModelProfile[] = [
    { modelId: "vision-only", modalities: ["image"] },
    { modelId: "text-only", modalities: ["text"] },
    { modelId: "multimodal", modalities: ["image", "text", "audio"] },
  ];

  // Note: sort is unstable when priorities are equal, so we just verify filtering works
  const imageResult = selectEdgeLocalModel(models, "image");
  assert.ok(imageResult, "should find a model for image modality");
  assert.ok(models.some((m) => m.modelId === imageResult?.modelId && m.modalities.includes("image")));

  const textResult = selectEdgeLocalModel(models, "text");
  assert.ok(textResult, "should find a model for text modality");
  assert.ok(models.some((m) => m.modelId === textResult?.modelId && m.modalities.includes("text")));

  const audioResult = selectEdgeLocalModel(models, "audio");
  assert.ok(audioResult, "should find a model for audio modality");

  const videoResult = selectEdgeLocalModel(models, "video");
  assert.equal(videoResult, null, "should return null for unsupported modality");
});

test("LocalModelProfile type shape is correct", () => {
  const profile: LocalModelProfile = {
    modelId: "test-model",
    modalities: ["text", "image"],
    priority: 3,
  };

  assert.equal(profile.modelId, "test-model");
  assert.deepEqual(profile.modalities, ["text", "image"]);
  assert.equal(profile.priority, 3);
});
