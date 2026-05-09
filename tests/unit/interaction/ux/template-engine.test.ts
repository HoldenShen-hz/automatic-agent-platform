import assert from "node:assert/strict";
import test from "node:test";

import {
  InteractionTemplateSchema,
  applyInteractionTemplate,
  instantiateTemplate,
  recommendTemplatesForDomain,
  type InteractionTemplate,
  validateTemplateForDomain,
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

test("template engine persists domainId riskProfile and version metadata", () => {
  const result = InteractionTemplateSchema.parse({
    templateId: "tpl_domain",
    title: "Domain Template",
    domainId: "finance",
    riskProfile: "high",
    version: "2026.05",
    steps: ["capture_invoice"],
  });

  assert.equal(result.domainId, "finance");
  assert.equal(result.riskProfile, "high");
  assert.equal(result.version, "2026.05");
});

test("validateTemplateForDomain rejects missing capabilities and domain mismatch", () => {
  const template: InteractionTemplate = {
    templateId: "tpl_finance",
    title: "Finance",
    domainId: "finance",
    requiredCapabilities: ["invoice.write"],
    steps: ["invoice_step"],
  };

  const result = validateTemplateForDomain(template, "hr", ["employee.read"]);

  assert.equal(result.compatible, false);
  assert.deepEqual(result.missingCapabilities, ["invoice.write"]);
});

test("recommendTemplatesForDomain ranks domain and risk aligned templates higher", () => {
  const templates: InteractionTemplate[] = [
    {
      templateId: "tpl_finance_high",
      title: "Finance High",
      domainId: "finance",
      riskProfile: "high",
      requiredCapabilities: ["invoice.write"],
      catalogTags: ["payables"],
      steps: ["invoice_step"],
    },
    {
      templateId: "tpl_general",
      title: "General",
      catalogTags: ["ops"],
      steps: ["general_step"],
    },
  ];

  const recommendations = recommendTemplatesForDomain(templates, {
    domainId: "finance",
    desiredRiskProfile: "high",
    desiredTags: ["payables"],
    availableCapabilities: ["invoice.write"],
  });

  assert.equal(recommendations[0]?.templateId, "tpl_finance_high");
  assert.ok(recommendations[0]?.reasons.includes("domain_match"));
  assert.ok(recommendations[0]?.reasons.includes("risk_profile_match"));
});

test("instantiateTemplate binds structured steps and required parameters", () => {
  const result = instantiateTemplate({
    templateId: "tpl_bind",
    title: "Bind",
    parameters: [{
      name: "region",
      label: "Region",
      type: "string",
      required: true,
    }],
    steps: [{
      stepId: "step_capture",
      inputMappings: { region: "{{region}}" },
      outputMappings: {},
    }],
  }, {
    region: "cn-east",
  });

  assert.deepEqual(result.boundSteps, ["step_capture"]);
  assert.equal(result.parameterValues.region, "cn-east");
});
