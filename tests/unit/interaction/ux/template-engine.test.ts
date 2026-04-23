import assert from "node:assert/strict";
import test from "node:test";

import {
  InteractionTemplateSchema,
  applyInteractionTemplate,
  type InteractionTemplate,
} from "../../../../src/interaction/ux/template-engine/index.js";

test("InteractionTemplateSchema validates correct template", () => {
  const result = InteractionTemplateSchema.safeParse({
    templateId: "tpl_1",
    title: "Test Template",
    steps: ["step1", "step2"],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.templateId, "tpl_1");
    assert.equal(result.data.title, "Test Template");
    assert.deepEqual(result.data.steps, ["step1", "step2"]);
  }
});

test("InteractionTemplateSchema applies default empty steps array", () => {
  const result = InteractionTemplateSchema.safeParse({
    templateId: "tpl_1",
    title: "Test Template",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.steps, []);
  }
});

test("InteractionTemplateSchema rejects empty templateId", () => {
  const result = InteractionTemplateSchema.safeParse({
    templateId: "",
    title: "Test Template",
  });

  assert.equal(result.success, false);
});

test("InteractionTemplateSchema rejects empty title", () => {
  const result = InteractionTemplateSchema.safeParse({
    templateId: "tpl_1",
    title: "",
  });

  assert.equal(result.success, false);
});

test("applyInteractionTemplate returns parsed template", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_1",
    title: "Test Template",
    steps: ["step1", "step2"],
  };

  const result = applyInteractionTemplate(template);

  assert.equal(result.templateId, "tpl_1");
  assert.equal(result.title, "Test Template");
  assert.deepEqual(result.steps, ["step1", "step2"]);
});

test("applyInteractionTemplate applies overrides", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_1",
    title: "Test Template",
    steps: ["step1", "step2"],
  };

  const result = applyInteractionTemplate(template, {
    templateId: "tpl_overridden",
    title: "Overridden Title",
  });

  assert.equal(result.templateId, "tpl_overridden");
  assert.equal(result.title, "Overridden Title");
  assert.deepEqual(result.steps, ["step1", "step2"]);
});

test("applyInteractionTemplate allows overriding steps", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_1",
    title: "Test Template",
    steps: ["step1", "step2"],
  };

  const result = applyInteractionTemplate(template, {
    steps: ["new_step1", "new_step2", "new_step3"],
  });

  assert.equal(result.templateId, "tpl_1");
  assert.deepEqual(result.steps, ["new_step1", "new_step2", "new_step3"]);
});

test("applyInteractionTemplate validates the result", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_1",
    title: "Test Template",
    steps: ["step1"],
  };

  // This should throw because we're overriding templateId with empty string
  assert.throws(() => {
    applyInteractionTemplate(template, { templateId: "" });
  });
});

test("InteractionTemplate type is correctly inferred", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_test",
    title: "Inferred Template",
    steps: ["a", "b", "c"],
  };

  assert.equal(template.templateId, "tpl_test");
  assert.equal(template.title, "Inferred Template");
  assert.equal(template.steps.length, 3);
});
