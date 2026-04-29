import assert from "node:assert/strict";
import test from "node:test";

import { PromptRendererService } from "../../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";

test("PromptRendererService integration with PromptTemplateRegistryService renders registered template", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "customer_support_assistant",
    version: "v1.0.0",
    owner: "support-team@example.com",
    fixedPrefix: "You are a helpful customer support assistant.",
    domainBlock: "Domain: Technical Support\nTier: Premium",
    variableSuffixTemplate: "Customer issue: {{issue}}\nProduct: {{product}}\nPriority: {{priority}}",
    variableSpecs: [
      { key: "issue", required: true, description: "The customer's issue description" },
      { key: "product", required: true, description: "Product name" },
      { key: "priority", required: false, defaultValue: "medium", description: "Issue priority" },
    ],
  });

  const result = renderer.render({
    template,
    variables: {
      issue: "Cannot login to my account",
      product: "Mobile App",
    },
  });

  assert.match(result.prompt, /helpful customer support assistant/);
  assert.match(result.prompt, /Technical Support/);
  assert.match(result.prompt, /Customer issue: Cannot login to my account/);
  assert.match(result.prompt, /Product: Mobile App/);
  assert.match(result.prompt, /Priority: medium/);
});

test("PromptRendererService integration with multiple templates renders different templates correctly", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template1 = registry.registerTemplate({
    templateKey: "template_a",
    version: "v1",
    owner: "owner_a@example.com",
    fixedPrefix: "Template A prefix",
    domainBlock: "Domain A",
    variableSuffixTemplate: "A: {{var_a}}",
    variableSpecs: [{ key: "var_a", required: true }],
  });

  const template2 = registry.registerTemplate({
    templateKey: "template_b",
    version: "v1",
    owner: "owner_b@example.com",
    fixedPrefix: "Template B prefix",
    domainBlock: "Domain B",
    variableSuffixTemplate: "B: {{var_b}}",
    variableSpecs: [{ key: "var_b", required: true }],
  });

  const result1 = renderer.render({ template: template1, variables: { var_a: "value_a" } });
  const result2 = renderer.render({ template: template2, variables: { var_b: "value_b" } });

  assert.match(result1.prompt, /Template A prefix/);
  assert.doesNotMatch(result1.prompt, /Template B prefix/);
  assert.match(result2.prompt, /Template B prefix/);
  assert.doesNotMatch(result2.prompt, /Template A prefix/);
  assert.match(result1.prompt, /A: value_a/);
  assert.match(result2.prompt, /B: value_b/);
});

test("PromptRendererService integration with versioned templates uses correct versions", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  registry.registerTemplate({
    templateKey: "versioned_template",
    version: "v1.0.0",
    owner: "owner@example.com",
    fixedPrefix: "Version 1 prefix",
    domainBlock: "Version 1 domain",
    variableSuffixTemplate: "Version: {{ver}}",
    variableSpecs: [{ key: "ver", required: true }],
  });

  registry.registerTemplate({
    templateKey: "versioned_template",
    version: "v2.0.0",
    owner: "owner@example.com",
    fixedPrefix: "Version 2 prefix",
    domainBlock: "Version 2 domain",
    variableSuffixTemplate: "Version: {{ver}}",
    variableSpecs: [{ key: "ver", required: true }],
  });

  const v1 = registry.getTemplate("versioned_template", "v1.0.0");
  const v2 = registry.getTemplate("versioned_template", "v2.0.0");

  assert.ok(v1);
  assert.ok(v2);

  const result1 = renderer.render({ template: v1, variables: { ver: "1" } });
  const result2 = renderer.render({ template: v2, variables: { ver: "2" } });

  assert.match(result1.prompt, /Version 1 prefix/);
  assert.match(result2.prompt, /Version 2 prefix/);
  assert.notEqual(result1.cacheKey, result2.cacheKey);
});

test("PromptRendererService integration with complex variable templates", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "complex_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System instruction",
    domainBlock: "Context information",
    variableSuffixTemplate:
      "Operation: {{operation}}\nTarget: {{target}}\nOptions: {{options}}\nMetadata: {{metadata}}",
    variableSpecs: [
      { key: "operation", required: true },
      { key: "target", required: true },
      { key: "options", required: false, defaultValue: "default_options" },
      { key: "metadata", required: false, defaultValue: "{}" },
    ],
  });

  const result = renderer.render({
    template,
    variables: {
      operation: "deploy",
      target: "production-cluster-1",
    },
  });

  assert.match(result.prompt, /Operation: deploy/);
  assert.match(result.prompt, /Target: production-cluster-1/);
  assert.match(result.prompt, /Options: default_options/);
  assert.match(result.prompt, /Metadata: {}/);
});

test("PromptRendererService integration with whitespace handling", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "whitespace_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "  Spaced prefix  ",
    domainBlock: "  Spaced domain  ",
    variableSuffixTemplate: "Value: {{val}}  ",
    variableSpecs: [{ key: "val", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { val: "  trimmed input  " },
  });

  assert.equal(result.segments.fixedPrefix, "Spaced prefix");
  assert.equal(result.segments.domainBlock, "Spaced domain");
  assert.match(result.prompt, /Value: trimmed input/);
});

test("PromptRendererService integration - cache key is consistent for same template", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "cache_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Fixed content",
    domainBlock: "Domain content",
    variableSuffixTemplate: "Var: {{var}}",
    variableSpecs: [{ key: "var", required: true }],
  });

  const result1 = renderer.render({ template, variables: { var: "value1" } });
  const result2 = renderer.render({ template, variables: { var: "value2" } });
  const result3 = renderer.render({ template, variables: { var: "value1" } });

  assert.equal(result1.cacheKey, result3.cacheKey);
  assert.equal(result2.cacheKey, result1.cacheKey);
});