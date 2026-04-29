import assert from "node:assert/strict";
import test from "node:test";

import { PromptRendererService } from "../../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("PromptRendererService renders prompt with all segments", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: customer support",
    variableSuffixTemplate: "User question: {{question}}\nContext: {{context}}",
    variableSpecs: [
      { key: "question", required: true },
      { key: "context", required: false, defaultValue: "general" },
    ],
  });

  const result = renderer.render({
    template,
    variables: { question: "How do I reset my password?" },
  });

  assert.match(result.prompt, /You are a helpful assistant/);
  assert.match(result.prompt, /Domain: customer support/);
  assert.match(result.prompt, /User question: How do I reset my password/);
  assert.match(result.prompt, /Context: general/);
  assert.equal(result.segments.fixedPrefix, "You are a helpful assistant.");
  assert.equal(result.segments.domainBlock, "Domain: customer support");
  assert.ok(result.prompt.includes("\n\n"));
});

test("PromptRendererService renders prompt with provided variable values", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "Domain block",
    variableSuffixTemplate: "Query: {{query}}\nLang: {{lang}}",
    variableSpecs: [
      { key: "query", required: true },
      { key: "lang", required: false, defaultValue: "en" },
    ],
  });

  const result = renderer.render({
    template,
    variables: { query: "test query", lang: "zh" },
  });

  assert.match(result.prompt, /Query: test query/);
  assert.match(result.prompt, /Lang: zh/);
  assert.equal(result.segments.variableSuffix, "Query: test query\nLang: zh");
});

test("PromptRendererService uses default values when variable not provided", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System",
    domainBlock: "Domain",
    variableSuffixTemplate: "Value: {{value}}",
    variableSpecs: [{ key: "value", required: false, defaultValue: "default_value" }],
  });

  const result = renderer.render({ template, variables: {} });

  assert.match(result.prompt, /Value: default_value/);
  assert.equal(result.unresolvedVariables.length, 0);
});

test("PromptRendererService throws when required variable is missing", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System",
    domainBlock: "Domain",
    variableSuffixTemplate: "Missing: {{required_var}}",
    variableSpecs: [{ key: "required_var", required: true }],
  });

  assert.throws(
    () => renderer.render({ template, variables: {} }),
    (err: unknown) =>
      err instanceof ValidationError && err.code.includes("missing_required_variables"),
  );
});

test("PromptRendererService throws for multiple missing required variables", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System",
    domainBlock: "Domain",
    variableSuffixTemplate: "A: {{a}} B: {{b}}",
    variableSpecs: [
      { key: "a", required: true },
      { key: "b", required: true },
    ],
  });

  assert.throws(
    () => renderer.render({ template, variables: {} }),
    (err: unknown) => {
      if (!(err instanceof ValidationError)) return false;
      return err.code.includes("missing_required_variables") &&
        err.message.includes("a") &&
        err.message.includes("b");
    },
  );
});

test("PromptRendererService excludes fixedPrefix when includeFixedPrefix is false", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Should not appear",
    domainBlock: "Domain block",
    variableSuffixTemplate: "Var: {{var}}",
    variableSpecs: [{ key: "var", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { var: "value" },
    includeFixedPrefix: false,
  });

  assert.equal(result.segments.fixedPrefix, "");
  assert.doesNotMatch(result.prompt, /Should not appear/);
  assert.match(result.prompt, /Domain block/);
});

test("PromptRendererService excludes domainBlock when includeDomainBlock is false", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Fixed prefix",
    domainBlock: "Should not appear",
    variableSuffixTemplate: "Var: {{var}}",
    variableSpecs: [{ key: "var", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { var: "value" },
    includeDomainBlock: false,
  });

  assert.equal(result.segments.domainBlock, "");
  assert.match(result.prompt, /Fixed prefix/);
  assert.doesNotMatch(result.prompt, /Should not appear/);
});

test("PromptRendererService generates correct cacheKey", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "cache_test",
    version: "v2",
    owner: "test@example.com",
    fixedPrefix: "Fixed content",
    domainBlock: "Domain content",
    variableSuffixTemplate: "Var: {{var}}",
    variableSpecs: [{ key: "var", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { var: "test" },
  });

  assert.equal(result.cacheKey, `cache_test:v2:${template.fixedPrefixHash}`);
});

test("PromptRendererService handles template with no variableSpecs", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "static_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Static prompt",
    domainBlock: "Static domain",
    variableSuffixTemplate: "",
    variableSpecs: [],
  });

  const result = renderer.render({ template, variables: {} });

  assert.match(result.prompt, /Static prompt/);
  assert.match(result.prompt, /Static domain/);
  assert.equal(result.unresolvedVariables.length, 0);
});

test("PromptRendererService trims whitespace from template segments", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "whitespace_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "  padded prefix  ",
    domainBlock: "  padded domain  ",
    variableSuffixTemplate: "  trimmed  ",
    variableSpecs: [],
  });

  const result = renderer.render({ template, variables: {} });

  assert.equal(result.segments.fixedPrefix, "padded prefix");
  assert.equal(result.segments.domainBlock, "padded domain");
  assert.equal(result.segments.variableSuffix, "trimmed");
});

test("PromptRendererService handles variables with extra whitespace", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "whitespace_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Prefix",
    domainBlock: "Domain",
    variableSuffixTemplate: "Value: {{val}}",
    variableSpecs: [{ key: "val", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { val: "  spaced value  " },
  });

  assert.match(result.prompt, /Value: spaced value/);
});

test("PromptRendererService returns empty segments when all excluded", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "empty_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Fixed",
    domainBlock: "Domain",
    variableSuffixTemplate: "Var: {{var}}",
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
  assert.match(result.prompt, /Var: value/);
});