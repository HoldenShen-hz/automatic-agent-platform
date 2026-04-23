import assert from "node:assert/strict";
import test from "node:test";
import * as costTracker from "../../../../src/platform/model-gateway/cost-tracker/index.js";
import * as degradation from "../../../../src/platform/model-gateway/degradation/index.js";
import * as fallback from "../../../../src/platform/model-gateway/fallback/index.js";
import * as messages from "../../../../src/platform/model-gateway/messages/index.js";
import { listModelGatewayCapabilityBaselines, resolveModelGatewayCapabilityBaseline, } from "../../../../src/platform/model-gateway/model-gateway-baseline.js";
import * as providerRegistry from "../../../../src/platform/model-gateway/provider-registry/index.js";
import * as router from "../../../../src/platform/model-gateway/router/index.js";
test("model-gateway baseline covers canonical AI routing services", () => {
    const baselines = listModelGatewayCapabilityBaselines();
    assert.deepEqual(baselines.map((item) => item.capabilityId), ["provider-registry", "router", "fallback", "degradation", "cost-tracker", "messages"]);
    assert.equal(resolveModelGatewayCapabilityBaseline("router").entryModule, "src/platform/model-gateway/router/index.ts");
});
test("model-gateway baseline service names resolve from canonical submodule exports", () => {
    const exportsByCapabilityId = {
        "provider-registry": providerRegistry,
        router,
        fallback,
        degradation,
        "cost-tracker": costTracker,
        messages,
    };
    for (const baseline of listModelGatewayCapabilityBaselines()) {
        const exportedModule = exportsByCapabilityId[baseline.capabilityId];
        for (const serviceName of baseline.baselineServices) {
            assert.equal(serviceName in exportedModule, true, `expected ${serviceName} to be exported by ${baseline.entryModule}`);
        }
    }
});
//# sourceMappingURL=model-gateway-baseline.test.js.map