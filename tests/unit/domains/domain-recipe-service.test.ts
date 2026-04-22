import assert from "node:assert/strict";
import test from "node:test";

import { DomainRecipeService } from "../../../src/domains/domain-recipe-service.js";

test("DomainRecipeService exposes 12 prototype templates", () => {
  const service = new DomainRecipeService();
  const templates = service.getPrototypeTemplates();

  assert.equal(templates.length, 12);
  assert.equal(new Set(templates.map((template) => template.templateId)).size, 12);
});

test("DomainRecipeService can create recipes from newly added prototype templates", () => {
  const service = new DomainRecipeService();
  const researchRecipe = service.createFromPrototype("knowledge-base", "prototype_research");
  const planningRecipe = service.createFromPrototype("quant-trading", "prototype_planning");

  assert.ok(researchRecipe);
  assert.equal(researchRecipe?.defaultWorkflowId, "research_workflow");
  assert.ok(planningRecipe);
  assert.equal(planningRecipe?.defaultWorkflowId, "planning_workflow");
});
