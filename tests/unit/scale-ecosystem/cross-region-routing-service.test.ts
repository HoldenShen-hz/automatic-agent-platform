import assert from "node:assert/strict";
import test from "node:test";

import { CrossRegionRoutingService } from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";

test("CrossRegionRoutingService honors residency policy before latency preference", () => {
  const service = new CrossRegionRoutingService();
  const decision = service.route({
    regions: [
      { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 20, residencyAllowed: true, capabilities: ["llm", "storage"] },
      { regionId: "us-west-2", jurisdiction: "US", latencyScore: 10, residencyAllowed: true, capabilities: ["llm", "storage"] },
      { regionId: "eu-central-1", jurisdiction: "EU", latencyScore: 15, residencyAllowed: true, capabilities: ["llm"] },
    ],
    policy: {
      policyId: "cn_only",
      allowedJurisdictions: ["CN"],
      requiredCapabilities: ["llm", "storage"],
      allowCrossBorder: false,
    },
    primaryRegionId: "cn-sh",
    primaryRegionHealthy: false,
    replicationPolicy: {
      sourceRegionId: "cn-sh",
      targetRegionIds: ["cn-bj", "cn-gz"],
      residencyMode: "same_jurisdiction",
    },
  });

  assert.equal(decision.selectedRegionId, "cn-sh");
  assert.deepEqual([...decision.blockedRegions].sort(), ["eu-central-1", "us-west-2"]);
  assert.equal(decision.residencyDecision, "allowed");
});
