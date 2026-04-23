import assert from "node:assert/strict";
import test from "node:test";
import * as interaction from "../../../src/interaction/index.js";
import * as autonomy from "../../../src/interaction/autonomy/index.js";
import * as dashboard from "../../../src/interaction/dashboard/index.js";
import * as goalDecomposer from "../../../src/interaction/goal-decomposer/index.js";
import { listInteractionCapabilityBaselines, resolveInteractionCapabilityBaseline, } from "../../../src/interaction/interaction-baseline-catalog.js";
import * as nlGateway from "../../../src/interaction/nl-gateway/index.js";
import * as proactiveAgent from "../../../src/interaction/proactive-agent/index.js";
import * as ux from "../../../src/interaction/ux/index.js";
test("interaction baseline catalog covers all six interaction capabilities", () => {
    const baselines = listInteractionCapabilityBaselines();
    assert.deepEqual(baselines.map((item) => item.capabilityId), ["nl-gateway", "goal-decomposer", "proactive-agent", "autonomy", "dashboard", "ux"]);
    assert.ok(resolveInteractionCapabilityBaseline("ux").baselineServices.includes("UserPortalService"));
});
test("interaction baseline service names resolve from canonical submodule and root exports", () => {
    const exportsByCapabilityId = {
        "nl-gateway": nlGateway,
        "goal-decomposer": goalDecomposer,
        "proactive-agent": proactiveAgent,
        autonomy,
        dashboard,
        ux,
    };
    for (const baseline of listInteractionCapabilityBaselines()) {
        const exportedModule = exportsByCapabilityId[baseline.capabilityId];
        for (const serviceName of baseline.baselineServices) {
            assert.equal(serviceName in exportedModule, true, `expected ${serviceName} to be exported by ${baseline.entryModule}`);
            assert.equal(serviceName in interaction, true, `expected ${serviceName} to be exported by src/interaction/index.ts`);
        }
    }
});
//# sourceMappingURL=interaction-baseline-catalog.test.js.map