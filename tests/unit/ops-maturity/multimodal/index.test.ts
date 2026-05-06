import assert from "node:assert/strict";
import test from "node:test";

import * as multimodal from "../../../../src/ops-maturity/multimodal/index.js";

test("multimodal index exports MultimodalGatewayService", () => {
  assert.ok(multimodal);
  assert.equal(typeof multimodal.MultimodalGatewayService, "function");
  assert.equal(typeof multimodal.parseMultimodalRequest, "function");
  assert.ok(multimodal.MultimodalRequestSchema);
  assert.ok(multimodal.MultimodalInputPartSchema);
  assert.ok(multimodal.ModalityRouteDecisionSchema);
  assert.ok(multimodal.MultimodalSafetyFindingSchema);
});
