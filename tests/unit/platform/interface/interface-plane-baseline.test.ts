import assert from "node:assert/strict";
import test from "node:test";

import {
  listInterfaceCapabilityBaselines,
  resolveInterfaceCapabilityBaseline,
} from "../../../../src/platform/interface/interface-plane-baseline.js";

test("interface plane baseline covers interface entry modules", () => {
  const baselines = listInterfaceCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"],
  );
  assert.ok(resolveInterfaceCapabilityBaseline("webhook").baselineServices.includes("WebhookIngressService"));
});
