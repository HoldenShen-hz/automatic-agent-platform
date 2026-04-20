import assert from "node:assert/strict";
import test from "node:test";

import { PromptRendererService } from "../../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptTemplateRegistryService } from "../../../../../src/platform/prompt-engine/registry/index.js";

test("PromptRendererService renders layered prompts with resolved variables", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "ops_triage",
    version: "v1",
    owner: "ops@example.com",
    fixedPrefix: "System guardrails",
    domainBlock: "Operations domain",
    variableSuffixTemplate: "Question: {{question}}\nRegion: {{region}}",
    variableSpecs: [
      { key: "question", required: true },
      { key: "region", required: false, defaultValue: "cn-shanghai" },
    ],
  });

  const result = renderer.render({
    template,
    variables: { question: "CPU high" },
  });

  assert.match(result.prompt, /System guardrails/);
  assert.match(result.prompt, /Operations domain/);
  assert.match(result.prompt, /Question: CPU high/);
  assert.match(result.prompt, /Region: cn-shanghai/);
  assert.equal(result.cacheKey, `${template.templateKey}:${template.version}:${template.fixedPrefixHash}`);
});

test("PromptRendererService rejects missing required variables", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "ops_triage",
    version: "v1",
    owner: "ops@example.com",
    fixedPrefix: "System guardrails",
    domainBlock: "Operations domain",
    variableSuffixTemplate: "Question: {{question}}",
    variableSpecs: [{ key: "question", required: true }],
  });

  assert.throws(() => renderer.render({ template, variables: {} }));
});
