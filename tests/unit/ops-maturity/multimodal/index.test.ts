import assert from "node:assert/strict";
import test from "node:test";

import * as multimodal from "../../../../src/ops-maturity/multimodal/index.js";

test("multimodal index exports MultimodalGatewayService", () => {
  assert.ok(multimodal);
  assert.equal(typeof multimodal.MultimodalGatewayService, "function");
});