import assert from "node:assert/strict";
import test from "node:test";
import * as feedbackLoop from "../../../src/scale-ecosystem/feedback-loop/index.js";
import * as integration from "../../../src/scale-ecosystem/integration/index.js";
import * as marketplace from "../../../src/scale-ecosystem/marketplace/index.js";
import * as multiRegion from "../../../src/scale-ecosystem/multi-region/index.js";
import * as resourceManager from "../../../src/scale-ecosystem/resource-manager/index.js";
import * as scaleRoot from "../../../src/scale-ecosystem/index.js";
import * as slaEngine from "../../../src/scale-ecosystem/sla-engine/index.js";
import { listScaleCapabilityBaselines, resolveScaleCapabilityBaseline, } from "../../../src/scale-ecosystem/scale-baseline-catalog.js";
test("scale baseline catalog covers ecosystem and scale capabilities", () => {
    const baselines = listScaleCapabilityBaselines();
    assert.equal(baselines.length, 6);
    assert.ok(resolveScaleCapabilityBaseline("marketplace").baselineServices.includes("MarketplaceGovernanceService"));
    assert.ok(resolveScaleCapabilityBaseline("integration").baselineServices.includes("ConnectorFrameworkService"));
});
test("scale baseline services resolve from canonical submodule and root exports", () => {
    const rootExports = scaleRoot;
    const submodulesByEntryModule = {
        "src/scale-ecosystem/multi-region/index.ts": multiRegion,
        "src/scale-ecosystem/resource-manager/index.ts": resourceManager,
        "src/scale-ecosystem/sla-engine/index.ts": slaEngine,
        "src/scale-ecosystem/marketplace/index.ts": marketplace,
        "src/scale-ecosystem/feedback-loop/index.ts": feedbackLoop,
        "src/scale-ecosystem/integration/index.ts": integration,
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
//# sourceMappingURL=scale-baseline-catalog.test.js.map