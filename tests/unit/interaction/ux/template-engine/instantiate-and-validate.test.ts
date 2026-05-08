/**
 * Unit tests for template-engine: instantiateTemplate and validateTemplateForDomain
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  instantiateTemplate,
  recommendTemplatesForDomain,
  validateTemplateForDomain,
  type InteractionTemplate,
} from "../../../../../src/interaction/ux/template-engine/index.js";

const createTemplate = (overrides: Partial<InteractionTemplate> = {}): InteractionTemplate => ({
  templateId: "tpl_001",
  title: "Test Template",
  domainId: "advertising",
  riskProfile: "medium",
  version: "1.0.0",
  catalogTags: ["advertising"],
  marketplaceBinding: {
    listingId: "listing_tpl_001",
    channel: "marketplace",
  },
  workflowDefaults: {
    divisionId: "advertising",
    workflowId: "campaign_launch",
    executionMode: "supervised",
    approvalMode: "simple",
  },
  parameters: [
    {
      name: "target audience",
      label: "Target Audience",
      type: "string",
      required: true,
    },
    {
      name: "budget",
      label: "Budget",
      type: "number",
      required: false,
      defaultValue: 1000,
    },
    {
      name: "channels",
      label: "Channels",
      type: "multiselect",
      required: false,
      options: [
        { value: "email", label: "Email" },
        { value: "social", label: "Social Media" },
      ],
    },
  ],
  steps: [
    { stepId: "step_1", inputMappings: {}, outputMappings: {} },
    { stepId: "step_2", inputMappings: {}, outputMappings: {} },
  ],
  ...overrides,
});

test("instantiateTemplate resolves required parameters", () => {
  const template = createTemplate();
  const result = instantiateTemplate(template, { "target audience": "developers" });

  assert.equal(result.boundSteps.length, 2);
  assert.equal(result.boundSteps[0], "step_1");
  assert.equal(result.boundSteps[1], "step_2");
});

test("instantiateTemplate throws for missing required parameters", () => {
  const template = createTemplate();
  assert.throws(
    () => instantiateTemplate(template, {}),
    /template\.missing_required_parameters/,
  );
});

test("instantiateTemplate applies default values for optional parameters", () => {
  const template = createTemplate();
  const result = instantiateTemplate(template, { "target audience": "test" });

  const budgetParam = result.workflowConfig.parameters.find((p) => p.name === "budget");
  assert.equal(budgetParam?.defaultValue, 1000);
});

test("instantiateTemplate merges provided parameter values", () => {
  const template = createTemplate();
  const result = instantiateTemplate(template, { "target audience": "vip", budget: 5000 });

  const audienceParam = result.workflowConfig.parameters.find((p) => p.name === "target audience");
  assert.equal(audienceParam?.defaultValue, "vip");

  const budgetParam = result.workflowConfig.parameters.find((p) => p.name === "budget");
  assert.equal(budgetParam?.defaultValue, 5000);
  assert.equal(result.parameterValues["budget"], 5000);
});

test("instantiateTemplate returns all step IDs as boundSteps", () => {
  const template = createTemplate({
    steps: [
      { stepId: "init", inputMappings: {}, outputMappings: {} },
      { stepId: "execute", inputMappings: {}, outputMappings: {} },
      { stepId: "finalize", inputMappings: {}, outputMappings: {} },
    ],
  });
  const result = instantiateTemplate(template, { "target audience": "test" });

  assert.deepEqual(result.boundSteps, ["init", "execute", "finalize"]);
});

test("instantiateTemplate handles template with no parameters", () => {
  const template = createTemplate({ parameters: [] });
  const result = instantiateTemplate(template);

  assert.equal(result.workflowConfig.parameters.length, 0);
  assert.deepEqual(result.boundSteps, ["step_1", "step_2"]);
});

test("validateTemplateForDomain returns compatible when domain matches and capabilities available", () => {
  const template = createTemplate({ domainId: "finance", requiredCapabilities: ["invoicing"] });
  const result = validateTemplateForDomain(template, "finance", ["invoicing", "payments"]);

  assert.equal(result.compatible, true);
  assert.deepEqual(result.missingCapabilities, []);
});

test("validateTemplateForDomain returns incompatible when domain does not match", () => {
  const template = createTemplate({ domainId: "finance", requiredCapabilities: ["invoicing"] });
  const result = validateTemplateForDomain(template, "hr", ["invoicing", "payments"]);

  assert.equal(result.compatible, false);
  // missingCapabilities is filtered from requiredCapabilities against availableCapabilities
  // Since "invoicing" IS available, missingCapabilities is empty; domain mismatch alone causes incompatibility
  assert.deepEqual(result.missingCapabilities, []);
});

test("validateTemplateForDomain returns incompatible when capabilities are missing", () => {
  const template = createTemplate({ domainId: "finance", requiredCapabilities: ["invoicing", "payments"] });
  const result = validateTemplateForDomain(template, "finance", ["invoicing"]);

  assert.equal(result.compatible, false);
  assert.deepEqual(result.missingCapabilities, ["payments"]);
});

test("validateTemplateForDomain returns compatible when all requirements met", () => {
  const template = createTemplate({ requiredCapabilities: [] });
  const result = validateTemplateForDomain(template, "advertising", []);

  assert.equal(result.compatible, true);
  assert.deepEqual(result.missingCapabilities, []);
});

test("validateTemplateForDomain returns compatible when domain matches and no capabilities required", () => {
  const template = createTemplate({ requiredCapabilities: [] });
  const result = validateTemplateForDomain(template, "advertising", ["anything"]);

  assert.equal(result.compatible, true);
  assert.deepEqual(result.missingCapabilities, []);
});

test("validateTemplateForDomain handles multiple missing capabilities", () => {
  const template = createTemplate({
    requiredCapabilities: ["cap_a", "cap_b", "cap_c"],
  });
  const result = validateTemplateForDomain(template, "advertising", ["cap_a"]);

  assert.equal(result.compatible, false);
  assert.deepEqual(result.missingCapabilities, ["cap_b", "cap_c"]);
});

test("validateTemplateForDomain handles empty available capabilities", () => {
  const template = createTemplate({ domainId: "finance", requiredCapabilities: ["payments"] });
  const result = validateTemplateForDomain(template, "finance", []);

  assert.equal(result.compatible, false);
  assert.deepEqual(result.missingCapabilities, ["payments"]);
});

test("recommendTemplatesForDomain ranks matching templates first", () => {
  const recommendations = recommendTemplatesForDomain([
    createTemplate({ templateId: "finance_1", domainId: "finance", requiredCapabilities: ["invoicing"], catalogTags: ["finance"] }),
    createTemplate({ templateId: "hr_1", domainId: "hr", requiredCapabilities: [] }),
  ], {
    domainId: "finance",
    availableCapabilities: ["invoicing"],
    desiredRiskProfile: "medium",
    desiredTags: ["finance"],
  });

  assert.equal(recommendations[0]?.templateId, "finance_1");
  assert.ok(recommendations[0]!.score >= recommendations[1]!.score);
});
