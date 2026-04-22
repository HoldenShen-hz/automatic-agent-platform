import assert from "node:assert/strict";
import test from "node:test";

import {
  listModelGatewayCapabilityBaselines,
  resolveModelGatewayCapabilityBaseline,
} from "../../../../src/platform/model-gateway/model-gateway-baseline.js";

test("model-gateway baseline covers canonical AI routing services", () => {
  const baselines = listModelGatewayCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["provider-registry", "router", "fallback", "degradation", "cost-tracker", "messages"],
  );
  assert.equal(resolveModelGatewayCapabilityBaseline("router").entryModule, "src/platform/model-gateway/router/index.ts");
});
