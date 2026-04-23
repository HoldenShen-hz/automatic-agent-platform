import assert from "node:assert/strict";
import test from "node:test";

import { selectEdgeLocalModel } from "../../../../src/ops-maturity/edge-runtime/local-model/index.js";

test("selectEdgeLocalModel returns model matching modality", () => {
  const models = [
    { modelId: "vision-model", modalities: ["image", "text"] },
    { modelId: "text-model", modalities: ["text"] },
  ];

  const result = selectEdgeLocalModel(models, "image");

  assert.equal(result?.modelId, "vision-model");
});

test("selectEdgeLocalModel returns null when no matching modality", () => {
  const models = [{ modelId: "text-model", modalities: ["text"] }];

  const result = selectEdgeLocalModel(models, "video");

  assert.equal(result, null);
});

test("selectEdgeLocalModel returns highest priority model when multiple match", () => {
  const models = [
    { modelId: "low-priority", modalities: ["text"], priority: 1 },
    { modelId: "high-priority", modalities: ["text"], priority: 10 },
  ];

  const result = selectEdgeLocalModel(models, "text");

  assert.equal(result?.modelId, "high-priority");
});

test("selectEdgeLocalModel defaults priority to 0", () => {
  const models = [
    { modelId: "default-priority", modalities: ["text"] },
    { modelId: "explicit-priority", modalities: ["text"], priority: 5 },
  ];

  const result = selectEdgeLocalModel(models, "text");

  assert.equal(result?.modelId, "explicit-priority");
});

test("selectEdgeLocalModel returns null for empty model list", () => {
  const result = selectEdgeLocalModel([], "text");
  assert.equal(result, null);
});
