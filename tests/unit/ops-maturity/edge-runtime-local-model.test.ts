import assert from "node:assert/strict";
import test from "node:test";
import {
  selectEdgeLocalModel,
  type LocalModelProfile,
} from "../../../src/ops-maturity/edge-runtime/local-model/index.js";

test("selectEdgeLocalModel returns highest priority model for matching modality", () => {
  const models: LocalModelProfile[] = [
    { modelId: "model_v1", modalities: ["text"], priority: 1 },
    { modelId: "model_v2", modalities: ["text", "vision"], priority: 3 },
    { modelId: "model_v3", modalities: ["text"], priority: 2 },
  ];

  const selected = selectEdgeLocalModel(models, "text");

  assert.strictEqual(selected?.modelId, "model_v2");
});

test("selectEdgeLocalModel returns null when no matching modality", () => {
  const models: LocalModelProfile[] = [
    { modelId: "model_v1", modalities: ["text"] },
    { modelId: "model_v2", modalities: ["vision"] },
  ];

  const selected = selectEdgeLocalModel(models, "audio");

  assert.strictEqual(selected, null);
});

test("selectEdgeLocalModel returns null for empty models array", () => {
  const selected = selectEdgeLocalModel([], "text");
  assert.strictEqual(selected, null);
});

test("selectEdgeLocalModel sorts by priority descending", () => {
  const models: LocalModelProfile[] = [
    { modelId: "low_priority", modalities: ["text"], priority: 1 },
    { modelId: "high_priority", modalities: ["text"], priority: 10 },
    { modelId: "medium_priority", modalities: ["text"], priority: 5 },
  ];

  const selected = selectEdgeLocalModel(models, "text");

  assert.strictEqual(selected?.modelId, "high_priority");
});

test("selectEdgeLocalModel treats missing priority as 0", () => {
  const models: LocalModelProfile[] = [
    { modelId: "no_priority", modalities: ["text"] },
    { modelId: "with_priority", modalities: ["text"], priority: 1 },
  ];

  const selected = selectEdgeLocalModel(models, "text");

  assert.strictEqual(selected?.modelId, "with_priority");
});

test("selectEdgeLocalModel filters by modality then sorts by priority", () => {
  const models: LocalModelProfile[] = [
    { modelId: "vision_only", modalities: ["vision"], priority: 100 },
    { modelId: "text_and_vision", modalities: ["text", "vision"], priority: 5 },
    { modelId: "text_only_high", modalities: ["text"], priority: 10 },
    { modelId: "text_only_low", modalities: ["text"], priority: 1 },
  ];

  const selected = selectEdgeLocalModel(models, "text");

  // Should only consider text models, highest priority is text_only_high
  assert.strictEqual(selected?.modelId, "text_only_high");
});