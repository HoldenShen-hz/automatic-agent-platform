import assert from "node:assert/strict";
import test from "node:test";
import { ComplianceCaseOrchestrationService, EscalationService, EvalDatasetJudgeService, ModelGatewayCacheService, PlatformPromptReleaseOrchestrationService, PluginExecutionService, } from "../../../src/platform/index.js";
test("platform barrel exposes core platform-level services", () => {
    assert.equal(typeof EscalationService, "function");
    assert.equal(typeof ModelGatewayCacheService, "function");
    assert.equal(typeof PluginExecutionService, "function");
    assert.equal(typeof EvalDatasetJudgeService, "function");
    assert.equal(typeof PlatformPromptReleaseOrchestrationService, "function");
    assert.equal(typeof ComplianceCaseOrchestrationService, "function");
});
//# sourceMappingURL=index.test.js.map