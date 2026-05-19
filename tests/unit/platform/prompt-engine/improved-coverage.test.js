/**
 * @fileoverview Improved coverage tests for src/platform/prompt-engine
 * Tests prompt engine components: renderer, registry, and template services
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PromptRendererService } from "../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptTemplateRegistryService, hashPromptPrefix } from "../../../../src/platform/prompt-engine/registry/index.js";
test("PromptRendererService render with includeFixedPrefix false", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed prefix text",
        domainBlock: "Domain block text",
        variableSuffixTemplate: "Variable: {{var}}",
        variableSpecs: [{ key: "var", required: true }],
    });
    const result = renderer.render({
        template,
        variables: { var: "value" },
        includeFixedPrefix: false,
    });
    assert.equal(result.segments.fixedPrefix, "");
    assert.ok(result.prompt.includes("Domain block text"));
    assert.ok(result.prompt.includes("Variable: value"));
});
test("PromptRendererService render with includeDomainBlock false", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed prefix text",
        domainBlock: "Domain block text",
        variableSuffixTemplate: "Variable: {{var}}",
        variableSpecs: [{ key: "var", required: true }],
    });
    const result = renderer.render({
        template,
        variables: { var: "value" },
        includeDomainBlock: false,
    });
    assert.equal(result.segments.domainBlock, "");
    assert.ok(result.prompt.includes("Fixed prefix text"));
    assert.ok(result.prompt.includes("Variable: value"));
});
test("PromptRendererService render with both fixedPrefix and domainBlock false", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed prefix text",
        domainBlock: "Domain block text",
        variableSuffixTemplate: "Variable: {{var}}",
        variableSpecs: [{ key: "var", required: true }],
    });
    const result = renderer.render({
        template,
        variables: { var: "value" },
        includeFixedPrefix: false,
        includeDomainBlock: false,
    });
    assert.equal(result.segments.fixedPrefix, "");
    assert.equal(result.segments.domainBlock, "");
    assert.equal(result.prompt, "Variable: value");
});
test("PromptRendererService render with default values", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed prefix",
        domainBlock: "Domain block",
        variableSuffixTemplate: "Region: {{region}}",
        variableSpecs: [{ key: "region", required: false, defaultValue: "us-east-1" }],
    });
    const result = renderer.render({
        template,
        variables: {},
    });
    assert.ok(result.prompt.includes("Region: us-east-1"));
    assert.equal(result.unresolvedVariables.length, 0);
});
test("PromptRendererService render with provided values overriding defaults", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed prefix",
        domainBlock: "Domain block",
        variableSuffixTemplate: "Region: {{region}}",
        variableSpecs: [{ key: "region", required: false, defaultValue: "us-east-1" }],
    });
    const result = renderer.render({
        template,
        variables: { region: "eu-west-1" },
    });
    assert.ok(result.prompt.includes("Region: eu-west-1"));
});
test("PromptRendererService render with empty variables object", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed prefix",
        domainBlock: "Domain block",
        variableSuffixTemplate: "",
        variableSpecs: [],
    });
    const result = renderer.render({
        template,
        variables: {},
    });
    assert.ok(result.prompt.includes("Fixed prefix"));
    assert.ok(result.prompt.includes("Domain block"));
    assert.equal(result.unresolvedVariables.length, 0);
});
test("PromptRendererService render with whitespace in variable placeholders", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed",
        domainBlock: "Domain",
        variableSuffixTemplate: "Value: {{  variable  }}",
        variableSpecs: [{ key: "variable", required: true }],
    });
    const result = renderer.render({
        template,
        variables: { variable: "test" },
    });
    assert.ok(result.prompt.includes("Value: test"));
});
test("PromptRendererService render with no matching variables", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test_template",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Fixed",
        domainBlock: "Domain",
        variableSuffixTemplate: "No variables here",
        variableSpecs: [],
    });
    const result = renderer.render({
        template,
        variables: { unused: "value" },
    });
    assert.ok(result.prompt.includes("No variables here"));
});
test("PromptTemplateRegistryService registerTemplate with all optional fields", () => {
    const registry = new PromptTemplateRegistryService();
    const record = registry.registerTemplate({
        templateKey: "test_key",
        version: "v1.0.0",
        owner: "owner@example.com",
        channel: "user",
        fixedPrefix: "System prompt",
        domainBlock: "Domain info",
        variableSuffixTemplate: "Input: {{input}}",
        variableSpecs: [{ key: "input", required: true, description: "User input" }],
        compatibilityTags: ["v1", "stable"],
    });
    assert.equal(record.templateKey, "test_key");
    assert.equal(record.version, "v1.0.0");
    assert.equal(record.channel, "user");
    assert.ok(record.fixedPrefixHash.length > 0);
});
test("PromptTemplateRegistryService registerTemplate defaults channel to system", () => {
    const registry = new PromptTemplateRegistryService();
    const record = registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
    });
    assert.equal(record.channel, "system");
});
test("PromptTemplateRegistryService getTemplate returns correct template", () => {
    const registry = new PromptTemplateRegistryService();
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix v1",
        domainBlock: "Domain",
    });
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v2",
        owner: "owner@example.com",
        fixedPrefix: "Prefix v2",
        domainBlock: "Domain",
    });
    const result = registry.getTemplate("test_key", "v1");
    assert.ok(result !== null);
    assert.equal(result.version, "v1");
    assert.ok(result.fixedPrefix.includes("v1"));
});
test("PromptTemplateRegistryService getTemplate returns null for non-existent", () => {
    const registry = new PromptTemplateRegistryService();
    const result = registry.getTemplate("non_existent", "v1");
    assert.equal(result, null);
});
test("PromptTemplateRegistryService getTemplate returns null for non-existent version", () => {
    const registry = new PromptTemplateRegistryService();
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
    });
    const result = registry.getTemplate("test_key", "v2");
    assert.equal(result, null);
});
test("PromptTemplateRegistryService listVersions returns sorted versions", () => {
    const registry = new PromptTemplateRegistryService();
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v2",
        owner: "owner@example.com",
        fixedPrefix: "Prefix v2",
        domainBlock: "Domain",
    });
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix v1",
        domainBlock: "Domain",
    });
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v3",
        owner: "owner@example.com",
        fixedPrefix: "Prefix v3",
        domainBlock: "Domain",
    });
    const versions = registry.listVersions("test_key");
    assert.equal(versions.length, 3);
    assert.equal(versions[0].version, "v1");
    assert.equal(versions[1].version, "v2");
    assert.equal(versions[2].version, "v3");
});
test("PromptTemplateRegistryService listVersions returns empty for non-existent template", () => {
    const registry = new PromptTemplateRegistryService();
    const versions = registry.listVersions("non_existent");
    assert.equal(versions.length, 0);
});
test("PromptTemplateRegistryService listTemplates returns all templates across keys", () => {
    const registry = new PromptTemplateRegistryService();
    registry.registerTemplate({
        templateKey: "key1",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
    });
    registry.registerTemplate({
        templateKey: "key2",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
    });
    const templates = registry.listTemplates();
    assert.equal(templates.length, 2);
});
test("PromptTemplateRegistryService throws on duplicate version", () => {
    const registry = new PromptTemplateRegistryService();
    registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
    });
    assert.throws(() => {
        registry.registerTemplate({
            templateKey: "test_key",
            version: "v1",
            owner: "owner@example.com",
            fixedPrefix: "Another prefix",
            domainBlock: "Domain",
        });
    });
});
test("PromptTemplateRegistryService throws on empty templateKey", () => {
    const registry = new PromptTemplateRegistryService();
    assert.throws(() => {
        registry.registerTemplate({
            templateKey: "",
            version: "v1",
            owner: "owner@example.com",
            fixedPrefix: "Prefix",
            domainBlock: "Domain",
        });
    });
});
test("PromptTemplateRegistryService throws on whitespace-only templateKey", () => {
    const registry = new PromptTemplateRegistryService();
    assert.throws(() => {
        registry.registerTemplate({
            templateKey: "   ",
            version: "v1",
            owner: "owner@example.com",
            fixedPrefix: "Prefix",
            domainBlock: "Domain",
        });
    });
});
test("PromptTemplateRegistryService throws on empty version", () => {
    const registry = new PromptTemplateRegistryService();
    assert.throws(() => {
        registry.registerTemplate({
            templateKey: "test_key",
            version: "",
            owner: "owner@example.com",
            fixedPrefix: "Prefix",
            domainBlock: "Domain",
        });
    });
});
test("PromptTemplateRegistryService throws on empty owner", () => {
    const registry = new PromptTemplateRegistryService();
    assert.throws(() => {
        registry.registerTemplate({
            templateKey: "test_key",
            version: "v1",
            owner: "",
            fixedPrefix: "Prefix",
            domainBlock: "Domain",
        });
    });
});
test("PromptTemplateRegistryService throws on empty fixedPrefix", () => {
    const registry = new PromptTemplateRegistryService();
    assert.throws(() => {
        registry.registerTemplate({
            templateKey: "test_key",
            version: "v1",
            owner: "owner@example.com",
            fixedPrefix: "",
            domainBlock: "Domain",
        });
    });
});
test("PromptTemplateRegistryService deduplicates variable specs by key", () => {
    const registry = new PromptTemplateRegistryService();
    const record = registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
        variableSuffixTemplate: "",
        variableSpecs: [
            { key: "var1", required: true },
            { key: "var1", required: false },
            { key: "var2", required: true },
        ],
    });
    // var1 should only appear once (first occurrence wins)
    assert.equal(record.variableSpecs.filter((s) => s.key === "var1").length, 1);
    assert.equal(record.variableSpecs.length, 2);
});
test("PromptTemplateRegistryService deduplicates and trims compatibility tags", () => {
    const registry = new PromptTemplateRegistryService();
    const record = registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
        compatibilityTags: ["  v1  ", "v1", "v2", "  v2  "],
    });
    assert.equal(record.compatibilityTags.length, 2);
    assert.ok(record.compatibilityTags.includes("v1"));
    assert.ok(record.compatibilityTags.includes("v2"));
});
test("PromptTemplateRegistryService filters empty compatibility tags", () => {
    const registry = new PromptTemplateRegistryService();
    const record = registry.registerTemplate({
        templateKey: "test_key",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
        compatibilityTags: ["v1", "", "  ", "v2"],
    });
    assert.equal(record.compatibilityTags.length, 2);
});
test("hashPromptPrefix generates consistent hash", () => {
    const hash1 = hashPromptPrefix("test prefix");
    const hash2 = hashPromptPrefix("test prefix");
    const hash3 = hashPromptPrefix("different prefix");
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hash3);
});
test("hashPromptPrefix returns 16 character hex string", () => {
    const hash = hashPromptPrefix("some prefix");
    assert.equal(hash.length, 16);
    assert.match(hash, /^[a-f0-9]+$/);
});
test("PromptRendererService cacheKey includes templateKey, version, and hash", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "cache_test",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
        variableSuffixTemplate: "",
        variableSpecs: [],
    });
    const result = renderer.render({ template, variables: {} });
    assert.ok(result.cacheKey.startsWith("cache_test:v1:"));
});
test("PromptRendererService unresolvedVariables is empty when all resolved", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "P",
        domainBlock: "D",
        variableSuffixTemplate: "{{a}}",
        variableSpecs: [{ key: "a", required: true }],
    });
    const result = renderer.render({ template, variables: { a: "1" } });
    assert.equal(result.unresolvedVariables.length, 0);
});
test("PromptRendererService throws ValidationError for missing required variables", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "P",
        domainBlock: "D",
        variableSuffixTemplate: "{{a}}",
        variableSpecs: [{ key: "a", required: true }],
    });
    assert.throws(() => renderer.render({ template, variables: {} }), /Prompt rendering requires variables/);
});
test("PromptRendererService render preserves whitespace in variableSuffixTemplate", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "P",
        domainBlock: "D",
        variableSuffixTemplate: "  Value: {{val}}  ",
        variableSpecs: [{ key: "val", required: true }],
    });
    const result = renderer.render({ template, variables: { val: "x" } });
    // The variableSuffix is trimmed when processing but whitespace before/after is preserved in the join
    assert.ok(result.prompt.includes("Value: x"));
});
test("PromptRendererService render uses variable default when provided value is empty string", () => {
    const registry = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const template = registry.registerTemplate({
        templateKey: "test",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "P",
        domainBlock: "D",
        variableSuffixTemplate: "Region: {{region}}",
        variableSpecs: [{ key: "region", required: false, defaultValue: "default-region" }],
    });
    const result = renderer.render({ template, variables: { region: "" } });
    assert.ok(result.prompt.includes("Region: default-region"));
});
//# sourceMappingURL=improved-coverage.test.js.map