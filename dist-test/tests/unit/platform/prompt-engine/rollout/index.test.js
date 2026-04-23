import assert from "node:assert/strict";
import test from "node:test";
import { PromptRolloutService } from "../../../../../src/platform/prompt-engine/rollout/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
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
test("PromptRolloutService evaluateGuardrail blocks when regression fails", () => {
    const rollout = new PromptRolloutService();
    const decision = rollout.evaluateGuardrail({
        mode: "suggest",
        regressionPassed: false,
        domainBlockCompatible: true,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.nextStatus, "blocked");
    assert.equal(decision.reason, "regression_gate_failed");
});
test("PromptRolloutService evaluateGuardrail blocks when domain block incompatible", () => {
    const rollout = new PromptRolloutService();
    const decision = rollout.evaluateGuardrail({
        mode: "suggest",
        regressionPassed: true,
        domainBlockCompatible: false,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.nextStatus, "blocked");
    assert.equal(decision.reason, "domain_block_incompatible");
});
test("PromptRolloutService evaluateGuardrail allows shadow mode when regression passes", () => {
    const rollout = new PromptRolloutService();
    const decision = rollout.evaluateGuardrail({
        mode: "shadow",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.nextStatus, "ready");
    assert.equal(decision.reason, "shadow_guardrail_passed");
});
test("PromptRolloutService evaluateGuardrail allows suggest mode when regression passes", () => {
    const rollout = new PromptRolloutService();
    const decision = rollout.evaluateGuardrail({
        mode: "suggest",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.nextStatus, "ready");
    assert.equal(decision.reason, "rollout_guardrail_passed");
});
test("PromptRolloutService evaluateGuardrail allows off mode when regression passes", () => {
    const rollout = new PromptRolloutService();
    const decision = rollout.evaluateGuardrail({
        mode: "off",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.nextStatus, "ready");
    assert.equal(decision.reason, "rollout_guardrail_passed");
});
test("PromptRolloutService activateRollout throws when rollout not found", () => {
    const rollout = new PromptRolloutService();
    assert.throws(() => rollout.activateRollout("nonexistent-id"), (err) => err instanceof ValidationError && err.message.includes("not found"));
});
test("PromptRolloutService activateRollout throws when status is not ready", () => {
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
    assert.throws(() => rollout.activateRollout(record.rolloutId), (err) => err instanceof ValidationError && err.message.includes("cannot transition to active"));
});
test("PromptRolloutService rollbackRollout throws when rollout not found", () => {
    const rollout = new PromptRolloutService();
    assert.throws(() => rollout.rollbackRollout("nonexistent-id", "test reason"), (err) => err instanceof ValidationError && err.message.includes("not found"));
});
test("PromptRolloutService rollbackRollout updates guardrailSummary with reason", () => {
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
        mode: "suggest",
        owner: "ops@example.com",
        regressionSuiteId: "suite_ops",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    const rolledBack = rollout.rollbackRollout(record.rolloutId, "customer_complaint");
    assert.equal(rolledBack.status, "rolled_back");
    assert.equal(rolledBack.guardrailSummary, "customer_complaint");
});
test("PromptRolloutService listRollouts returns all rollouts when no filter", () => {
    const registry = new PromptTemplateRegistryService();
    const rollout = new PromptRolloutService();
    const template1 = registry.registerTemplate({
        templateKey: "template_a",
        version: "v1",
        owner: "owner_a@example.com",
        fixedPrefix: "Prefix A",
        domainBlock: "Domain A",
    });
    const template2 = registry.registerTemplate({
        templateKey: "template_b",
        version: "v1",
        owner: "owner_b@example.com",
        fixedPrefix: "Prefix B",
        domainBlock: "Domain B",
    });
    rollout.createRollout({
        template: template1,
        mode: "suggest",
        owner: "owner_a@example.com",
        regressionSuiteId: "suite_a",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    rollout.createRollout({
        template: template2,
        mode: "shadow",
        owner: "owner_b@example.com",
        regressionSuiteId: "suite_b",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    const all = rollout.listRollouts();
    assert.equal(all.length, 2);
    const filtered = rollout.listRollouts("template_a");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.templateKey, "template_a");
});
test("PromptRolloutService createRollout trims owner and regressionSuiteId", () => {
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
        mode: "suggest",
        owner: "  owner@example.com  ",
        regressionSuiteId: "  suite_ops  ",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    assert.equal(record.owner, "owner@example.com");
    assert.equal(record.regressionSuiteId, "suite_ops");
});
test("PromptRolloutService createRollout sets status to ready when guardrail passes", () => {
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
        mode: "suggest",
        owner: "ops@example.com",
        regressionSuiteId: "suite_ops",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    assert.equal(record.status, "ready");
    assert.equal(record.guardrailSummary, "rollout_guardrail_passed");
});
test("PromptRolloutService createRollout stores rollout in internal map", () => {
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
        mode: "suggest",
        owner: "ops@example.com",
        regressionSuiteId: "suite_ops",
        regressionPassed: true,
        domainBlockCompatible: true,
    });
    const all = rollout.listRollouts();
    assert.ok(all.length >= 1);
    const retrieved = all.find((r) => r.rolloutId === record.rolloutId);
    assert.ok(retrieved);
    assert.equal(retrieved?.rolloutId, record.rolloutId);
});
//# sourceMappingURL=index.test.js.map