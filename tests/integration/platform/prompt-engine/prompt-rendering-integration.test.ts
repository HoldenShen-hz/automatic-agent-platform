import assert from "node:assert/strict";
import test from "node:test";

import { PromptRendererService } from "../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptTemplateRegistryService } from "../../../../src/platform/prompt-engine/registry/index.js";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

test("prompt renderer produces prompt with all segments joined by newlines", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_all_segments",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: customer_support",
    variableSuffixTemplate: "User question: {{question}}",
    variableSpecs: [{ key: "question", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { question: "How do I reset my password?" },
  });

  assert.ok(result.prompt.includes("You are a helpful assistant."));
  assert.ok(result.prompt.includes("Domain: customer_support"));
  assert.ok(result.prompt.includes("How do I reset my password?"));
  assert.ok(result.segments.fixedPrefix.length > 0);
  assert.ok(result.segments.domainBlock.length > 0);
  assert.ok(result.segments.variableSuffix.length > 0);
  assert.ok(result.unresolvedVariables.length === 0);
});

test("prompt renderer uses default values when variable not provided", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_defaults",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "",
    variableSuffixTemplate: "Task: {{task_name}}",
    variableSpecs: [{ key: "task_name", required: false, defaultValue: "default_task" }],
  });

  const result = renderer.render({ template, variables: {} });

  assert.ok(result.prompt.includes("default_task"));
  assert.equal(result.unresolvedVariables.length, 0);
});

test("prompt renderer throws ValidationError for missing required variables", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_required_missing",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "",
    variableSuffixTemplate: "Task: {{task_name}}",
    variableSpecs: [{ key: "task_name", required: true }],
  });

  assert.throws(
    () => renderer.render({ template, variables: {} }),
    (err) => errorCode(err) === "prompt_renderer.missing_required_variables:task_name",
  );
});

test("prompt renderer respects includeFixedPrefix false to omit fixed prefix", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_no_fixed_prefix",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "Domain block",
    variableSuffixTemplate: "Var: {{val}}",
    variableSpecs: [{ key: "val", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { val: "test" },
    includeFixedPrefix: false,
  });

  assert.equal(result.segments.fixedPrefix, "");
  assert.ok(result.prompt.includes("Domain block"));
  assert.ok(result.prompt.includes("Var: test"));
});

test("prompt renderer respects includeDomainBlock false to omit domain block", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_no_domain_block",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "Domain block",
    variableSuffixTemplate: "Var: {{val}}",
    variableSpecs: [{ key: "val", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { val: "test" },
    includeDomainBlock: false,
  });

  assert.equal(result.segments.domainBlock, "");
  assert.ok(result.prompt.includes("System prompt"));
  assert.ok(result.prompt.includes("Var: test"));
});

test("prompt renderer generates consistent cache key using template metadata", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_cache_key",
    version: "v2",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "Domain block",
    variableSuffixTemplate: "Var: {{val}}",
    variableSpecs: [{ key: "val", required: true }],
  });

  const result1 = renderer.render({ template, variables: { val: "test1" } });
  const result2 = renderer.render({ template, variables: { val: "test2" } });

  assert.equal(result1.cacheKey, result2.cacheKey);
  assert.ok(result1.cacheKey.includes("test_renderer_cache_key"));
  assert.ok(result1.cacheKey.includes("v2"));
});

test("prompt renderer replaces multiple variables in variable suffix template", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_multi_var",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System",
    domainBlock: "",
    variableSuffixTemplate: "Task: {{task}}, Priority: {{priority}}, Assignee: {{assignee}}",
    variableSpecs: [
      { key: "task", required: true },
      { key: "priority", required: true },
      { key: "assignee", required: true },
    ],
  });

  const result = renderer.render({
    template,
    variables: { task: "deploy", priority: "high", assignee: "alice" },
  });

  assert.ok(result.prompt.includes("Task: deploy"));
  assert.ok(result.prompt.includes("Priority: high"));
  assert.ok(result.prompt.includes("Assignee: alice"));
});

test("prompt renderer handles empty variable suffix template", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test_renderer_empty_suffix",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prompt",
    domainBlock: "Domain block",
    variableSuffixTemplate: "",
    variableSpecs: [],
  });

  const result = renderer.render({ template, variables: {} });

  assert.equal(result.segments.variableSuffix, "");
  assert.ok(result.prompt.includes("System prompt"));
  assert.ok(result.prompt.includes("Domain block"));
});
