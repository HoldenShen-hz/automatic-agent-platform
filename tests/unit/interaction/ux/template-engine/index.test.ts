import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInteractionTemplate,
  InteractionTemplateSchema,
  type InteractionTemplate,
} from "../../../../../src/interaction/ux/template-engine/index.js";

test("applyInteractionTemplate returns template with all original fields", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_001",
    title: "Test Template",
    steps: ["step1", "step2", "step3"],
  };

  const result = applyInteractionTemplate(template);

  assert.equal(result.templateId, "tpl_001");
  assert.equal(result.title, "Test Template");
  assert.deepEqual(result.steps, ["step1", "step2", "step3"]);
});

test("applyInteractionTemplate applies overrides correctly", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_001",
    title: "Original Title",
    steps: ["step1"],
  };

  const result = applyInteractionTemplate(template, { title: "New Title" });

  assert.equal(result.templateId, "tpl_001");
  assert.equal(result.title, "New Title");
  assert.deepEqual(result.steps, ["step1"]);
});

test("applyInteractionTemplate applies multiple overrides", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_001",
    title: "Original",
    steps: ["a", "b"],
  };

  const result = applyInteractionTemplate(template, {
    title: "Updated",
    steps: ["x", "y", "z"],
  });

  assert.equal(result.title, "Updated");
  assert.deepEqual(result.steps, ["x", "y", "z"]);
});

test("applyInteractionTemplate does not modify original template", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_001",
    title: "Original",
    steps: ["step1"],
  };

  applyInteractionTemplate(template, { title: "Modified" });

  assert.equal(template.title, "Original");
});

test("applyInteractionTemplate handles empty override object", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_001",
    title: "Title",
    steps: ["step1", "step2"],
  };

  const result = applyInteractionTemplate(template, {});

  assert.equal(result.templateId, "tpl_001");
  assert.equal(result.title, "Title");
  assert.deepEqual(result.steps, ["step1", "step2"]);
});

test("InteractionTemplateSchema validates valid template", () => {
  const valid = {
    templateId: "valid_id",
    title: "Valid Title",
    steps: ["step1", "step2"],
  };

  const result = InteractionTemplateSchema.parse(valid);

  assert.equal(result.templateId, "valid_id");
  assert.equal(result.title, "Valid Title");
});

test("InteractionTemplateSchema provides default steps", () => {
  const minimal = {
    templateId: "minimal",
    title: "Minimal",
  };

  const result = InteractionTemplateSchema.parse(minimal);

  assert.deepEqual(result.steps, []);
});

test("InteractionTemplateSchema rejects empty templateId", () => {
  const invalid = {
    templateId: "",
    title: "Title",
    steps: [],
  };

  assert.throws(() => InteractionTemplateSchema.parse(invalid));
});

test("InteractionTemplateSchema rejects empty title", () => {
  const invalid = {
    templateId: "id",
    title: "",
    steps: [],
  };

  assert.throws(() => InteractionTemplateSchema.parse(invalid));
});

test("InteractionTemplateSchema accepts template with optional fields omitted", () => {
  const minimal = {
    templateId: "id",
    title: "title",
  };

  const result = InteractionTemplateSchema.parse(minimal);

  assert.equal(result.templateId, "id");
  assert.equal(result.title, "title");
  assert.deepEqual(result.steps, []);
});

test("applyInteractionTemplate handles partial override with only templateId", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_001",
    title: "Original Title",
    steps: ["step1", "step2"],
  };

  const result = applyInteractionTemplate(template, {
    templateId: "tpl_002",
  });

  assert.equal(result.templateId, "tpl_002");
  assert.equal(result.title, "Original Title");
  assert.deepEqual(result.steps, ["step1", "step2"]);
});
