import test from "node:test";
import assert from "node:assert/strict";

import { growthDomainDefinition } from "../../../src/plugins/growth-config.js";

test("growthDomainDefinition can be imported", () => {
  assert.ok(growthDomainDefinition !== undefined);
  assert.ok(typeof growthDomainDefinition === "object");
});

test("growthDomainDefinition has correct domain identity", () => {
  assert.equal(growthDomainDefinition.domainId, "growth");
  assert.equal(growthDomainDefinition.name, "Growth");
  assert.equal(growthDomainDefinition.version, 1);
  assert.equal(growthDomainDefinition.status, "active");
});

test("growthDomainDefinition has valid description", () => {
  assert.ok(growthDomainDefinition.description.length > 0);
  assert.ok(growthDomainDefinition.description.includes("Growth"));
});

test("growthDomainDefinition has three workflows", () => {
  assert.equal(growthDomainDefinition.workflows.length, 3);
});

test("growthDomainDefinition workflows have valid trigger conditions", () => {
  const workflowIds = growthDomainDefinition.workflows.map((w) => w.workflowId);
  assert.ok(workflowIds.includes("campaign_optimization"));
  assert.ok(workflowIds.includes("customer_analytics"));
  assert.ok(workflowIds.includes("growth_experiment"));
});

test("campaign_optimization workflow structure is valid", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "campaign_optimization");
  assert.ok(workflow !== undefined);
  assert.equal(workflow!.name, "Campaign Optimization");
  assert.deepEqual(workflow!.triggerConditions, { taskType: "campaign" });
  assert.equal(workflow!.steps.length, 3);

  const stepNames = workflow!.steps.map((s) => s.stepName);
  assert.ok(stepNames.includes("fetch_campaign_data"));
  assert.ok(stepNames.includes("analyze_variants"));
  assert.ok(stepNames.includes("recommend_optimizations"));
});

test("campaign_optimization steps have valid model hints", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "campaign_optimization");
  for (const step of workflow!.steps) {
    assert.ok(step.modelHints.preferredModel === "MiniMax-M1");
    assert.ok(step.modelHints.temperature !== undefined);
    assert.ok(step.modelHints.temperature >= 0 && step.modelHints.temperature <= 1);
  }
});

test("campaign_optimization steps have valid retry policies", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "campaign_optimization");
  for (const step of workflow!.steps) {
    assert.ok(typeof step.retryPolicy.maxRetries === "number");
    assert.ok(typeof step.retryPolicy.backoffMs === "number");
    assert.ok(step.retryPolicy.maxRetries >= 0);
    assert.ok(step.retryPolicy.backoffMs >= 0);
  }
});

test("campaign_optimization steps have valid timeouts", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "campaign_optimization");
  for (const step of workflow!.steps) {
    assert.ok(step.timeoutMs > 0);
  }
});

test("customer_analytics workflow structure is valid", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "customer_analytics");
  assert.ok(workflow !== undefined);
  assert.equal(workflow!.name, "Customer Analytics");
  assert.deepEqual(workflow!.triggerConditions, { taskType: "analytics" });
  assert.equal(workflow!.steps.length, 2);

  const stepNames = workflow!.steps.map((s) => s.stepName);
  assert.ok(stepNames.includes("query_customer_segments"));
  assert.ok(stepNames.includes("analyze_funnel"));
});

test("customer_analytics workflow has valid step dependencies", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "customer_analytics");
  const firstStep = workflow!.steps[0];
  const secondStep = workflow!.steps[1];

  assert.deepEqual(firstStep.dependsOn, []);
  assert.deepEqual(secondStep.dependsOn, ["query_customer_segments"]);
});

test("growth_experiment workflow structure is valid", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "growth_experiment");
  assert.ok(workflow !== undefined);
  assert.equal(workflow!.name, "Growth Experiment Design");
  assert.deepEqual(workflow!.triggerConditions, { taskType: "experiment" });
  assert.equal(workflow!.steps.length, 2);

  const stepNames = workflow!.steps.map((s) => s.stepName);
  assert.ok(stepNames.includes("research_playbooks"));
  assert.ok(stepNames.includes("design_experiment"));
});

test("growth_experiment steps have requiresReview set correctly", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "growth_experiment");
  const researchStep = workflow!.steps.find((s) => s.stepName === "research_playbooks");
  const designStep = workflow!.steps.find((s) => s.stepName === "design_experiment");

  assert.equal(researchStep!.requiresReview, false);
  assert.equal(designStep!.requiresReview, true);
});

test("growthDomainDefinition has growth-core tool bundle", () => {
  const bundle = growthDomainDefinition.toolBundles.find((b) => b.bundleId === "growth-core");
  assert.ok(bundle !== undefined);
  assert.ok(bundle!.tools.length > 0);
});

test("growth-core tool bundle has all required tools enabled", () => {
  const bundle = growthDomainDefinition.toolBundles.find((b) => b.bundleId === "growth-core");
  const toolNames = bundle!.tools.map((t) => t.toolName);

  assert.ok(toolNames.includes("crm_query"));
  assert.ok(toolNames.includes("analytics_fetch"));
  assert.ok(toolNames.includes("abtest_query"));
  assert.ok(toolNames.includes("knowledge_retrieve"));
  assert.ok(toolNames.includes("summarize"));

  for (const tool of bundle!.tools) {
    assert.equal(tool.enabled, true);
    assert.ok(typeof tool.configOverrides === "object");
  }
});

test("growthDomainDefinition has three output contracts", () => {
  assert.equal(growthDomainDefinition.outputContracts.length, 3);
});

test("output contracts have valid contract IDs", () => {
  const contractIds = growthDomainDefinition.outputContracts.map((c) => c.contractId);
  assert.ok(contractIds.includes("growth.campaign_optimization"));
  assert.ok(contractIds.includes("growth.customer_analytics"));
  assert.ok(contractIds.includes("growth.growth_experiment"));
});

test("output contracts have valid validation levels", () => {
  const campaign = growthDomainDefinition.outputContracts.find((c) => c.contractId === "growth.campaign_optimization");
  assert.equal(campaign!.validationLevel, "lenient");

  const analytics = growthDomainDefinition.outputContracts.find((c) => c.contractId === "growth.customer_analytics");
  assert.equal(analytics!.validationLevel, "strict");

  const experiment = growthDomainDefinition.outputContracts.find((c) => c.contractId === "growth.growth_experiment");
  assert.equal(experiment!.validationLevel, "strict");
});

test("output contracts have valid schemas", () => {
  for (const contract of growthDomainDefinition.outputContracts) {
    assert.ok(contract.schema !== undefined);
    assert.ok(typeof contract.schema === "object");
    assert.ok(Object.keys(contract.schema).length > 0);
  }
});

test("growthDomainDefinition has valid capabilities", () => {
  assert.ok(growthDomainDefinition.capabilities !== undefined);
});

test("growthDomainDefinition capabilities has supported task types", () => {
  const supportedTypes = growthDomainDefinition.capabilities.supportedTaskTypes;
  assert.ok(Array.isArray(supportedTypes));
  assert.ok(supportedTypes.length > 0);
  assert.ok(supportedTypes.includes("campaign"));
  assert.ok(supportedTypes.includes("analytics"));
  assert.ok(supportedTypes.includes("experiment"));
});

test("growthDomainDefinition capabilities has required tools", () => {
  const requiredTools = growthDomainDefinition.capabilities.requiredTools;
  assert.ok(Array.isArray(requiredTools));
  assert.ok(requiredTools.includes("crm_query"));
  assert.ok(requiredTools.includes("analytics_fetch"));
  assert.ok(requiredTools.includes("knowledge_retrieve"));
});

test("growthDomainDefinition capabilities has optional tools", () => {
  const optionalTools = growthDomainDefinition.capabilities.optionalTools;
  assert.ok(Array.isArray(optionalTools));
  assert.ok(optionalTools.includes("abtest_query"));
  assert.ok(optionalTools.includes("summarize"));
  assert.ok(optionalTools.includes("plan"));
});

test("growthDomainDefinition capabilities has valid model preferences", () => {
  const prefs = growthDomainDefinition.capabilities.modelPreferences;
  assert.ok(prefs["campaign_optimization"] !== undefined);
  assert.ok(prefs["customer_analytics"] !== undefined);
  assert.ok(prefs["growth_experiment"] !== undefined);

  for (const model of Object.values(prefs)) {
    assert.ok(typeof model === "string");
    assert.ok(model.length > 0);
  }
});

test("growthDomainDefinition capabilities has valid budget limits", () => {
  const limits = growthDomainDefinition.capabilities.budgetLimits;
  assert.ok(limits.maxTokensPerTask > 0);
  assert.ok(limits.maxCostPerTask > 0);
  assert.ok(limits.maxTokensPerTask === 8000);
  assert.ok(limits.maxCostPerTask === 3.0);
});

test("growthDomainDefinition capabilities has valid security level", () => {
  assert.equal(growthDomainDefinition.capabilities.securityLevel, "standard");
});

test("growthDomainDefinition has external adapters", () => {
  const adapters = growthDomainDefinition.externalAdapters;
  assert.ok(Array.isArray(adapters));
  assert.ok(adapters.includes("github"));
  assert.ok(adapters.includes("jira"));
});

test("growthDomainDefinition has four plugin bindings", () => {
  assert.equal(growthDomainDefinition.pluginBindings.length, 4);
});

test("plugin bindings have valid structure", () => {
  for (const binding of growthDomainDefinition.pluginBindings) {
    assert.ok(binding.bindingId.length > 0);
    assert.ok(binding.domainId.length > 0);
    assert.ok(binding.pluginId.length > 0);
    assert.ok(typeof binding.enabled === "boolean");
    assert.ok(typeof binding.priority === "number");
    assert.ok(binding.priority >= 0);
  }
});

test("retriever plugin binding is valid", () => {
  const binding = growthDomainDefinition.pluginBindings.find((b) => b.bindingId === "growth.retriever");
  assert.ok(binding !== undefined);
  assert.equal(binding!.pluginId, "plugin.growth.retriever");
  assert.equal(binding!.pluginType, "retriever");
  assert.equal(binding!.priority, 10);
  assert.equal(binding!.enabled, true);
});

test("presenter plugin binding is valid", () => {
  const binding = growthDomainDefinition.pluginBindings.find((b) => b.bindingId === "growth.presenter");
  assert.ok(binding !== undefined);
  assert.equal(binding!.pluginId, "plugin.growth.presenter");
  assert.equal(binding!.pluginType, "tool");
  assert.equal(binding!.bindingRole, "presenter");
  assert.equal(binding!.priority, 10);
  assert.equal(binding!.enabled, true);
});

test("validator plugin binding uses core basic-evaluator", () => {
  const binding = growthDomainDefinition.pluginBindings.find((b) => b.bindingId === "growth.validator");
  assert.ok(binding !== undefined);
  assert.equal(binding!.pluginId, "plugin.core.basic-evaluator");
  assert.equal(binding!.pluginType, "evaluator");
  assert.equal(binding!.bindingRole, "validator");
  assert.equal(binding!.priority, 5);
  assert.equal(binding!.enabled, true);
});

test("planner plugin binding uses core basic-planner", () => {
  const binding = growthDomainDefinition.pluginBindings.find((b) => b.bindingId === "growth.planner");
  assert.ok(binding !== undefined);
  assert.equal(binding!.pluginId, "plugin.core.basic-planner");
  assert.equal(binding!.pluginType, "tool");
  assert.equal(binding!.bindingRole, "planner");
  assert.equal(binding!.priority, 1);
  assert.equal(binding!.enabled, true);
});

test("growthDomainDefinition has valid prompt overrides", () => {
  assert.ok(growthDomainDefinition.promptOverrides !== undefined);
  const systemPrompt = growthDomainDefinition.promptOverrides["system"];
  assert.ok(systemPrompt !== undefined);
  assert.ok(typeof systemPrompt === "string");
  assert.ok(systemPrompt.length > 0);
  assert.ok(systemPrompt.includes("Growth AI"));
});

test("growthDomainDefinition has correct status", () => {
  assert.ok(growthDomainDefinition.status === "active");
});

test("growthDomainDefinition structure is stable for serialization", () => {
  const serialized = JSON.stringify(growthDomainDefinition);
  const deserialized = JSON.parse(serialized);

  assert.equal(deserialized.domainId, "growth");
  assert.equal(deserialized.name, "Growth");
  assert.equal(deserialized.workflows.length, 3);
  assert.equal(deserialized.toolBundles.length, 1);
  assert.equal(deserialized.outputContracts.length, 3);
  assert.equal(deserialized.pluginBindings.length, 4);
});
