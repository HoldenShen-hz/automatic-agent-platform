import assert from "node:assert/strict";
import test from "node:test";
import { PromptTemplateRegistryService, hashPromptPrefix, } from "../../../../../src/platform/prompt-engine/registry/index.js";
test("PromptTemplateRegistryService registers and lists prompt templates", () => {
    const service = new PromptTemplateRegistryService();
    const record = service.registerTemplate({
        templateKey: "ops_triage",
        version: "v1",
        owner: "ops@example.com",
        fixedPrefix: "System guardrails",
        domainBlock: "Operations domain",
        variableSuffixTemplate: "Question: {{question}}",
        variableSpecs: [{ key: "question", required: true }],
        compatibilityTags: ["ops", "triage"],
    });
    assert.equal(record.templateKey, "ops_triage");
    assert.equal(record.fixedPrefixHash, hashPromptPrefix("System guardrails"));
    assert.equal(service.listVersions("ops_triage").length, 1);
});
test("PromptTemplateRegistryService rejects duplicate template versions", () => {
    const service = new PromptTemplateRegistryService();
    service.registerTemplate({
        templateKey: "ops_triage",
        version: "v1",
        owner: "ops@example.com",
        fixedPrefix: "System guardrails",
        domainBlock: "Operations domain",
    });
    assert.throws(() => service.registerTemplate({
        templateKey: "ops_triage",
        version: "v1",
        owner: "ops@example.com",
        fixedPrefix: "Different prefix",
        domainBlock: "Operations domain",
    }));
});
//# sourceMappingURL=index.test.js.map