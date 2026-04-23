import assert from "node:assert/strict";
import test from "node:test";

import {
  resolvePromptTemplate,
  DomainPromptTemplateSchema,
  DomainPromptLibrarySchema,
} from "../../../../src/domains/prompt-library/index.js";
import type { DomainPromptLibrary } from "../../../../src/domains/prompt-library/index.js";

function createTestLibrary(): DomainPromptLibrary {
  return DomainPromptLibrarySchema.parse({
    libraryId: "lib_coding",
    domainId: "coding",
    prompts: [
      {
        promptId: "prompt_plan",
        stage: "plan",
        version: "1.0",
        template: "Plan the task",
        guardrails: ["cite_sources"],
      },
      {
        promptId: "prompt_execute",
        stage: "execute",
        version: "1.0",
        template: "Execute the plan",
        guardrails: [],
      },
    ],
  });
}

test("resolvePromptTemplate returns prompt when found", () => {
  const library = createTestLibrary();

  const prompt = resolvePromptTemplate(library, "prompt_plan");

  assert.ok(prompt);
  assert.equal(prompt.promptId, "prompt_plan");
  assert.equal(prompt.stage, "plan");
  assert.equal(prompt.version, "1.0");
  assert.equal(prompt.template, "Plan the task");
});

test("resolvePromptTemplate returns null when prompt not found", () => {
  const library = createTestLibrary();

  const prompt = resolvePromptTemplate(library, "unknown_prompt");

  assert.equal(prompt, null);
});

test("resolvePromptTemplate returns null for empty library", () => {
  const library = DomainPromptLibrarySchema.parse({
    libraryId: "lib_empty",
    domainId: "empty",
    prompts: [],
  });

  const prompt = resolvePromptTemplate(library, "any_prompt");

  assert.equal(prompt, null);
});

test("DomainPromptTemplateSchema accepts valid prompt template", () => {
  const result = DomainPromptTemplateSchema.safeParse({
    promptId: "prompt_1",
    stage: "plan",
    version: "1.0",
    template: "Test template",
    guardrails: ["rule1", "rule2"],
  });

  assert.equal(result.success, true);
  assert.equal(result.data?.promptId, "prompt_1");
  assert.equal(result.data?.stage, "plan");
});

test("DomainPromptTemplateSchema accepts all valid stages", () => {
  const stages = ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"] as const;
  for (const stage of stages) {
    const result = DomainPromptTemplateSchema.safeParse({
      promptId: "p1",
      stage,
      version: "1.0",
      template: "Test",
    });
    assert.equal(result.success, true, `Stage ${stage} should be valid`);
  }
});

test("DomainPromptTemplateSchema rejects invalid stage", () => {
  const result = DomainPromptTemplateSchema.safeParse({
    promptId: "p1",
    stage: "invalid_stage",
    version: "1.0",
    template: "Test",
  });

  assert.equal(result.success, false);
});

test("DomainPromptTemplateSchema applies defaults", () => {
  const result = DomainPromptTemplateSchema.parse({
    promptId: "p1",
    stage: "plan",
    version: "1.0",
    template: "Test template",
  });

  assert.deepEqual(result.guardrails, []);
});

test("DomainPromptTemplateSchema requires non-empty promptId", () => {
  const result = DomainPromptTemplateSchema.safeParse({
    promptId: "",
    stage: "plan",
    version: "1.0",
    template: "Test",
  });

  assert.equal(result.success, false);
});

test("DomainPromptTemplateSchema requires non-empty template", () => {
  const result = DomainPromptTemplateSchema.safeParse({
    promptId: "p1",
    stage: "plan",
    version: "1.0",
    template: "",
  });

  assert.equal(result.success, false);
});

test("DomainPromptLibrarySchema accepts valid library", () => {
  const result = DomainPromptLibrarySchema.safeParse({
    libraryId: "lib_coding",
    domainId: "coding",
    prompts: [
      { promptId: "p1", stage: "plan", version: "1.0", template: "Test" },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.data?.libraryId, "lib_coding");
});

test("DomainPromptLibrarySchema applies defaults for prompts", () => {
  const result = DomainPromptLibrarySchema.parse({
    libraryId: "lib_min",
    domainId: "coding",
  });

  assert.deepEqual(result.prompts, []);
});
