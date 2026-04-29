import assert from "node:assert/strict";
import test from "node:test";

import {
  assemblePromptSegments,
  embedCanaryToken,
  detectCanaryTokenLeakage,
  protectSystemPrompt,
  sanitizePromptInput,
} from "../../../../src/platform/prompt-engine/prompt-injection-guard.js";
import {
  PromptTemplateRegistryService,
  hashPromptPrefix,
} from "../../../../src/platform/prompt-engine/registry/index.js";
import {
  PromptRendererService,
  type RenderPromptInput,
} from "../../../../src/platform/prompt-engine/renderer/index.js";

// ============================================================================
// assemblePromptSegments Tests
// ============================================================================

test("assemblePromptSegments combines system and user segments correctly", () => {
  const result = assemblePromptSegments({
    systemPrompt: "You are a helpful assistant.",
    userInput: "Hello, how are you?",
    scope: "test-scope",
  });

  assert.ok(result.canaryToken.length > 0);
  assert.ok(result.segments.length === 2);
  assert.equal(result.segments[0]?.role, "system");
  assert.equal(result.segments[1]?.role, "user");
  assert.ok(result.guardedPrompt.includes("SYSTEM:"));
  assert.ok(result.guardedPrompt.includes("USER:"));
});

test("assemblePromptSegments sanitizes user input", () => {
  const maliciousInput = "Hello <script>alert('xss')</script>";
  const result = assemblePromptSegments({
    systemPrompt: "You are a helpful assistant.",
    userInput: maliciousInput,
    scope: "test-scope",
  });

  assert.ok(result.guardedPrompt.includes("&lt;script&gt;"));
  assert.ok(!result.guardedPrompt.includes("<script>"));
});

test("assemblePromptSegments embeds canary token in system prompt", () => {
  const result = assemblePromptSegments({
    systemPrompt: "You are a helpful assistant.",
    userInput: "Test input",
    scope: "test-scope",
  });

  assert.ok(result.segments[0]?.content.includes("guard:"));
  assert.ok(result.canaryToken.startsWith("canary_"));
});

// ============================================================================
// Cache Key Consistency Tests
// ============================================================================

test("PromptRendererService cache key is consistent for same inputs", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: General Assistance",
    variableSuffixTemplate: "User: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const input1: RenderPromptInput = {
    template,
    variables: { task: "Write a poem" },
  };

  const input2: RenderPromptInput = {
    template,
    variables: { task: "Write a poem" },
  };

  const result1 = renderer.render(input1);
  const result2 = renderer.render(input2);

  assert.equal(result1.cacheKey, result2.cacheKey);
});

test("PromptRendererService different template keys produce different cache keys", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template1 = registry.registerTemplate({
    templateKey: "template-alpha",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: General",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const template2 = registry.registerTemplate({
    templateKey: "template-beta",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: General",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result1 = renderer.render({ template: template1, variables: { task: "Same task" } });
  const result2 = renderer.render({ template: template2, variables: { task: "Same task" } });

  assert.notEqual(result1.cacheKey, result2.cacheKey);
});

test("PromptRendererService different versions produce different cache keys", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: General",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const template2 = registry.registerTemplate({
    templateKey: "test-template",
    version: "2.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: General",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result = renderer.render({ template: template2, variables: { task: "Same task" } });

  assert.ok(result.cacheKey.includes("2.0.0"));
});

test("PromptRendererService same fixedPrefix produces same fixedPrefixHash", () => {
  const hash1 = hashPromptPrefix("You are a helpful assistant.");
  const hash2 = hashPromptPrefix("You are a helpful assistant.");

  assert.equal(hash1, hash2);
});

test("PromptRendererService different fixedPrefix produces different fixedPrefixHash", () => {
  const hash1 = hashPromptPrefix("You are a helpful assistant.");
  const hash2 = hashPromptPrefix("You are a different assistant.");

  assert.notEqual(hash1, hash2);
});

test("PromptRendererService cache key includes fixedPrefixHash", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: General",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result = renderer.render({ template, variables: { task: "test" } });
  const expectedHash = hashPromptPrefix("You are a helpful assistant.");

  assert.ok(result.cacheKey.includes(expectedHash));
});

// ============================================================================
// Template Substitution Tests
// ============================================================================

test("PromptRendererService template substitution works correctly", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Task:",
    variableSuffixTemplate: "{{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result = renderer.render({ template, variables: { task: "Write a story" } });

  assert.ok(result.prompt.includes("Write a story"));
  assert.ok(result.unresolvedVariables.length === 0);
});

test("PromptRendererService multiple variables substituted correctly", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "Assistant:",
    domainBlock: "Context:",
    variableSuffixTemplate: "Task: {{task}}, Language: {{language}}",
    variableSpecs: [
      { key: "task", required: true },
      { key: "language", required: true },
    ],
  });

  const result = renderer.render({
    template,
    variables: { task: "Translate", language: "English" },
  });

  assert.ok(result.prompt.includes("Task: Translate"));
  assert.ok(result.prompt.includes("Language: English"));
});

test("PromptRendererService default values are used when not provided", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "Assistant:",
    domainBlock: "Task:",
    variableSuffixTemplate: "Priority: {{priority}}",
    variableSpecs: [
      { key: "priority", required: false, defaultValue: "normal" },
    ],
  });

  const result = renderer.render({ template, variables: {} });

  assert.ok(result.prompt.includes("Priority: normal"));
  assert.ok(result.unresolvedVariables.length === 0);
});

test("PromptRendererService required variables without values throw error", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "Assistant:",
    domainBlock: "Task:",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  let thrown = false;
  try {
    renderer.render({ template, variables: {} });
  } catch (error) {
    thrown = true;
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes("task"));
  }
  assert.equal(thrown, true);
});

test("PromptRendererService includeFixedPrefix false removes fixed prefix", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "Fixed prefix content",
    domainBlock: "Domain block content",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { task: "test" },
    includeFixedPrefix: false,
  });

  assert.ok(!result.prompt.includes("Fixed prefix content"));
  assert.ok(result.prompt.includes("Domain block content"));
  assert.ok(result.prompt.includes("Task: test"));
});

test("PromptRendererService includeDomainBlock false removes domain block", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "Fixed prefix content",
    domainBlock: "Domain block content",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { task: "test" },
    includeDomainBlock: false,
  });

  assert.ok(result.prompt.includes("Fixed prefix content"));
  assert.ok(!result.prompt.includes("Domain block content"));
  assert.ok(result.prompt.includes("Task: test"));
});

test("PromptRendererService returns segments with correct structure", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();

  const template = registry.registerTemplate({
    templateKey: "test-template",
    version: "1.0.0",
    owner: "test-owner",
    fixedPrefix: "System prompt",
    domainBlock: "Domain context",
    variableSuffixTemplate: "Task: {{task}}",
    variableSpecs: [{ key: "task", required: true }],
  });

  const result = renderer.render({ template, variables: { task: "test" } });

  assert.ok(result.segments.fixedPrefix.length > 0);
  assert.ok(result.segments.domainBlock.length > 0);
  assert.ok(result.segments.variableSuffix.length > 0);
});

// ============================================================================
// Edge Cases
// ============================================================================

test("assemblePromptSegments handles empty user input", () => {
  const result = assemblePromptSegments({
    systemPrompt: "You are a helpful assistant.",
    userInput: "",
    scope: "test-scope",
  });

  assert.ok(result.canaryToken.length > 0);
  assert.ok(result.segments.length === 2);
  assert.equal(result.segments[1]?.content, "");
});

test("assemblePromptSegments handles special characters in scope", () => {
  const result1 = assemblePromptSegments({
    systemPrompt: "Test",
    userInput: "Input",
    scope: "scope:with:colons",
  });

  const result2 = assemblePromptSegments({
    systemPrompt: "Test",
    userInput: "Input",
    scope: "scope_with_underscores",
  });

  assert.notEqual(result1.canaryToken, result2.canaryToken);
});

test("sanitizePromptInput escapes HTML entities", () => {
  const input = 'Hello <script>alert("xss")</script> & "quotes"';
  const sanitized = sanitizePromptInput(input);

  assert.ok(sanitized.includes("&lt;"));
  assert.ok(sanitized.includes("&gt;"));
  assert.ok(sanitized.includes("&amp;"));
  assert.ok(!sanitized.includes("<script>"));
});

test("hashPromptPrefix produces consistent SHA256 hash (truncated to 16 chars)", () => {
  const hash = hashPromptPrefix("Test prefix content");

  assert.equal(hash.length, 16);
  assert.equal(hash, hashPromptPrefix("Test prefix content"));
});

test("protectSystemPrompt returns complete protection plan", () => {
  const result = protectSystemPrompt({
    systemPrompt: "You are a helpful assistant.",
    userInput: "Hello",
    scope: "test",
  });

  assert.ok(result.canaryToken.length > 0);
  assert.ok(result.guardedPrompt.length > 0);
  assert.ok(result.segments.length === 2);
  assert.ok(result.riskLevel === "low" || result.riskLevel === "medium" || result.riskLevel === "high");
  assert.equal(typeof result.allowExecution, "boolean");
});

test("detectCanaryTokenLeakage detects token in output", () => {
  const embedded = embedCanaryToken("System prompt", "test-scope");

  const outputWithLeak = `Here is the response. ${embedded.token} was revealed.`;
  const outputWithoutLeak = "Here is a normal response.";

  assert.equal(detectCanaryTokenLeakage(outputWithLeak, embedded.token), true);
  assert.equal(detectCanaryTokenLeakage(outputWithoutLeak, embedded.token), false);
});
