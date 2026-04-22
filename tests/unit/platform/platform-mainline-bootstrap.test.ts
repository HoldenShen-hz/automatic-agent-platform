import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlatformMainlineCapabilities,
  resolvePlatformMainlineCapability,
} from "../../../src/platform/platform-mainline-bootstrap.js";

test("platform mainline bootstrap captures W1/W2 critical surfaces", () => {
  const capabilities = listPlatformMainlineCapabilities();
  assert.deepEqual(
    capabilities.map((item) => item.capabilityId),
    ["interface", "control-plane", "orchestration", "execution", "state-evidence", "model-gateway", "prompt-engine", "compliance"],
  );
  assert.ok(resolvePlatformMainlineCapability("orchestration").criticalSubmodules.includes("harness"));
  assert.ok(resolvePlatformMainlineCapability("prompt-engine").criticalSubmodules.includes("conversation-template"));
});
