import assert from "node:assert/strict";
import test from "node:test";
import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
test("PromptRolloutService blocks rollout when regression guardrail fails", () => {
    const registry = new PromptTemplateRegistryService();
    const rollout = new PromptRolloutService();
    const template = registry.registerTemplate({
        templateKey: "ops_triage",
        version: "v1",
        owner: "ops@example.com",
        fixedPrefix: "System guardrails",
        domainBlock: "Operations domain",
    });
    const record = rollout.createRollout({
        template,
        mode: "shadow",
        owner: "ops@example.com",
        regressionSuiteId: "suite_ops",
        regressionPassed: false,
        domainBlockCompatible: true,
    });
    assert.equal(record.status, "blocked");
    assert.equal(record.guardrailSummary, "regression_gate_failed");
});
test("PromptRolloutService activates ready rollout and supports rollback", () => {
    const registry = new PromptTemplateRegistryService();
    const rollout = new PromptRolloutService();
    const template = registry.registerTemplate({
        templateKey: "ops_triage",
        version: "v1",
        owner: "ops@example.com",
        fixedPrefix: "System guardrails",
        domainBlock: "Operations domain",
    });
    const created = rollout.createRollout({
        template,
        mode: "suggest",
        owner: "ops@example.com",
        regressionSuiteId: "suite_ops",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    const active = rollout.activateRollout(created.rolloutId);
    const rolledBack = rollout.rollbackRollout(active.rolloutId, "manual_rollback");
    assert.equal(active.status, "active");
    assert.equal(rolledBack.status, "rolled_back");
});
//# sourceMappingURL=index.test.js.map