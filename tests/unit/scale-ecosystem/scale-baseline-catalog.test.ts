import assert from "node:assert/strict";
import test from "node:test";

import * as billing from "../../../src/scale-ecosystem/billing/index.js";
import * as enterprise from "../../../src/scale-ecosystem/enterprise/index.js";
import * as feedbackLoop from "../../../src/scale-ecosystem/feedback-loop/index.js";
import * as intelligence from "../../../src/scale-ecosystem/intelligence/index.js";
import * as integration from "../../../src/scale-ecosystem/integration/index.js";
import * as marketplace from "../../../src/scale-ecosystem/marketplace/index.js";
import * as multiRegion from "../../../src/scale-ecosystem/multi-region/index.js";
import * as operations from "../../../src/scale-ecosystem/operations/index.js";
import * as resourceManager from "../../../src/scale-ecosystem/resource-manager/index.js";
import * as scaleRoot from "../../../src/scale-ecosystem/index.js";
import * as slaEngine from "../../../src/scale-ecosystem/sla-engine/index.js";
import * as tenantPlatform from "../../../src/scale-ecosystem/tenant-platform/index.js";
import {
  listScaleCapabilityBaselines,
  resolveScaleCapabilityBaseline,
} from "../../../src/scale-ecosystem/scale-baseline-catalog.js";

test("scale baseline catalog covers ecosystem and scale capabilities [scale-baseline-catalog]", () => {
  const baselines = listScaleCapabilityBaselines();
  assert.equal(baselines.length, 11);
  assert.ok(resolveScaleCapabilityBaseline("marketplace").baselineServices.includes("MarketplaceGovernanceService"));
  assert.ok(resolveScaleCapabilityBaseline("billing").baselineServices.includes("BillingService"));
  assert.ok(resolveScaleCapabilityBaseline("tenant-platform").baselineServices.includes("TenantPlatformService"));
  assert.ok(resolveScaleCapabilityBaseline("intelligence").baselineServices.includes("PerceptionService"));
  assert.ok(resolveScaleCapabilityBaseline("enterprise").baselineServices.includes("EnterpriseCapabilityMatrixService"));
  assert.ok(resolveScaleCapabilityBaseline("operations").baselineServices.includes("PlatformOperatorService"));
  assert.ok(resolveScaleCapabilityBaseline("integration").baselineServices.includes("ConnectorFrameworkService"));
});

test("scale baseline services resolve from canonical submodule and root exports [scale-baseline-catalog]", () => {
  const rootExports = scaleRoot as Record<string, unknown>;
  const submodulesByEntryModule: Record<string, Record<string, unknown>> = {
    "src/scale-ecosystem/billing/index.ts": billing as Record<string, unknown>,
    "src/scale-ecosystem/enterprise/index.ts": enterprise as Record<string, unknown>,
    "src/scale-ecosystem/multi-region/index.ts": multiRegion as Record<string, unknown>,
    "src/scale-ecosystem/resource-manager/index.ts": resourceManager as Record<string, unknown>,
    "src/scale-ecosystem/sla-engine/index.ts": slaEngine as Record<string, unknown>,
    "src/scale-ecosystem/marketplace/index.ts": marketplace as Record<string, unknown>,
    "src/scale-ecosystem/feedback-loop/index.ts": feedbackLoop as Record<string, unknown>,
    "src/scale-ecosystem/integration/index.ts": integration as Record<string, unknown>,
    "src/scale-ecosystem/intelligence/index.ts": intelligence as Record<string, unknown>,
    "src/scale-ecosystem/operations/index.ts": operations as Record<string, unknown>,
    "src/scale-ecosystem/tenant-platform/index.ts": tenantPlatform as Record<string, unknown>,
  };

  for (const baseline of listScaleCapabilityBaselines()) {
    const submodule = submodulesByEntryModule[baseline.entryModule];
    assert.ok(submodule, `missing submodule mapping for ${baseline.entryModule}`);
    for (const serviceName of baseline.baselineServices) {
      assert.notEqual(rootExports[serviceName], undefined, `root export missing ${serviceName}`);
      assert.notEqual(submodule[serviceName], undefined, `submodule export missing ${serviceName}`);
    }
  }
});
