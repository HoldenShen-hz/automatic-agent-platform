import test from "node:test";
import assert from "node:assert/strict";

import { growthDomainDefinition } from "../../../src/plugins/growth-config.js";

test("growthDomainDefinition exports valid structure", () => {
  assert.equal(growthDomainDefinition.domainId, "growth");
  assert.equal(growthDomainDefinition.name, "Growth");
  assert.equal(growthDomainDefinition.version, 1);
  assert.equal(growthDomainDefinition.status, "active");
});

test("growthDomainDefinition has three workflows", () => {
  assert.equal(growthDomainDefinition.workflows.length, 3);
  const workflowIds = growthDomainDefinition.workflows.map((w) => w.workflowId);
  assert.ok(workflowIds.includes("campaign_optimization"));
  assert.ok(workflowIds.includes("customer_analytics"));
  assert.ok(workflowIds.includes("growth_experiment"));
});

test("campaign_optimization workflow has correct structure", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "campaign_optimization")!;
  assert.equal(workflow.name, "Campaign Optimization");
  assert.deepEqual(workflow.triggerConditions, { taskType: "campaign" });
  assert.equal(workflow.steps.length, 3);
  assert.equal(workflow.steps[0]!.stepName, "fetch_campaign_data");
  assert.equal(workflow.steps[1]!.stepName, "analyze_variants");
  assert.equal(workflow.steps[2]!.stepName, "recommend_optimizations");
  assert.equal(workflow.steps[1]!.requiresReview, true);
});

test("customer_analytics workflow has correct structure", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "customer_analytics")!;
  assert.equal(workflow.name, "Customer Analytics");
  assert.deepEqual(workflow.triggerConditions, { taskType: "analytics" });
  assert.equal(workflow.steps.length, 2);
  assert.equal(workflow.steps[0]!.stepName, "query_customer_segments");
  assert.equal(workflow.steps[1]!.stepName, "analyze_funnel");
});

test("growth_experiment workflow has correct structure", () => {
  const workflow = growthDomainDefinition.workflows.find((w) => w.workflowId === "growth_experiment")!;
  assert.equal(workflow.name, "Growth Experiment Design");
  assert.deepEqual(workflow.triggerConditions, { taskType: "experiment" });
  assert.equal(workflow.steps.length, 2);
  assert.equal(workflow.steps[0]!.stepName, "research_playbooks");
  assert.equal(workflow.steps[1]!.stepName, "design_experiment");
});

test("growthDomainDefinition has growth-core tool bundle", () => {
  const bundle = growthDomainDefinition.toolBundles.find((b) => b.bundleId === "growth-core");
  assert.ok(bundle !== undefined);
  assert.ok(bundle!.tools.some((t) => t.toolName === "crm_query"));
  assert.ok(bundle!.tools.some((t) => t.toolName === "analytics_fetch"));
  assert.ok(bundle!.tools.some((t) => t.toolName === "abtest_query"));
});

test("growthDomainDefinition has three output contracts", () => {
  assert.equal(growthDomainDefinition.outputContracts.length, 3);
  const contractIds = growthDomainDefinition.outputContracts.map((c) => c.contractId);
  assert.ok(contractIds.includes("growth.campaign_optimization"));
  assert.ok(contractIds.includes("growth.customer_analytics"));
  assert.ok(contractIds.includes("growth.growth_experiment"));
});

test("growthDomainDefinition output contracts have correct validation levels", () => {
  const campaign = growthDomainDefinition.outputContracts.find((c) => c.contractId === "growth.campaign_optimization");
  assert.equal(campaign!.validationLevel, "lenient");
  const analytics = growthDomainDefinition.outputContracts.find((c) => c.contractId === "growth.customer_analytics");
  assert.equal(analytics!.validationLevel, "strict");
  const experiment = growthDomainDefinition.outputContracts.find((c) => c.contractId === "growth.growth_experiment");
  assert.equal(experiment!.validationLevel, "strict");
});

test("growthDomainDefinition has correct capabilities", () => {
  assert.deepEqual(growthDomainDefinition.capabilities.supportedTaskTypes, [
    "campaign",
    "analytics",
    "experiment",
    "ab_test",
    "cohort_analysis",
  ]);
  assert.ok(growthDomainDefinition.capabilities.requiredTools.includes("crm_query"));
  assert.ok(growthDomainDefinition.capabilities.requiredTools.includes("analytics_fetch"));
});

test("growthDomainDefinition has correct model preferences", () => {
  assert.equal(growthDomainDefinition.capabilities.modelPreferences["campaign_optimization"], "claude-sonnet");
  assert.equal(growthDomainDefinition.capabilities.modelPreferences["customer_analytics"], "claude-sonnet");
  assert.equal(growthDomainDefinition.capabilities.modelPreferences["growth_experiment"], "claude-sonnet");
});

test("growthDomainDefinition has correct budget limits", () => {
  assert.equal(growthDomainDefinition.capabilities.budgetLimits.maxTokensPerTask, 8000);
  assert.equal(growthDomainDefinition.capabilities.budgetLimits.maxCostPerTask, 3.0);
});

test("growthDomainDefinition has correct security level", () => {
  assert.equal(growthDomainDefinition.capabilities.securityLevel, "standard");
});

test("growthDomainDefinition has external adapters", () => {
  assert.ok(growthDomainDefinition.externalAdapters.includes("github"));
  assert.ok(growthDomainDefinition.externalAdapters.includes("jira"));
});

test("growthDomainDefinition has plugin bindings", () => {
  assert.equal(growthDomainDefinition.pluginBindings.length, 4);
  const bindingIds = growthDomainDefinition.pluginBindings.map((b) => b.bindingId);
  assert.ok(bindingIds.includes("growth.retriever"));
  assert.ok(bindingIds.includes("growth.presenter"));
  assert.ok(bindingIds.includes("growth.validator"));
  assert.ok(bindingIds.includes("growth.planner"));
});

test("growth validator plugin binding uses core basic-evaluator", () => {
  const binding = growthDomainDefinition.pluginBindings.find((b) => b.bindingId === "growth.validator");
  assert.ok(binding !== undefined);
  assert.equal(binding!.pluginId, "plugin.core.basic-evaluator");
  assert.equal(binding!.pluginType, "validator");
  assert.equal(binding!.priority, 5);
  assert.equal(binding!.enabled, true);
});

test("growth planner plugin binding uses core basic-planner", () => {
  const binding = growthDomainDefinition.pluginBindings.find((b) => b.bindingId === "growth.planner");
  assert.ok(binding !== undefined);
  assert.equal(binding!.pluginId, "plugin.core.basic-planner");
  assert.equal(binding!.pluginType, "planner");
  assert.equal(binding!.priority, 1);
  assert.equal(binding!.enabled, true);
});

test("growthDomainDefinition has prompt overrides", () => {
  const systemPrompt = growthDomainDefinition.promptOverrides["system"];
  assert.ok(systemPrompt);
  assert.ok((systemPrompt as string).includes("Growth AI"));
  assert.ok((systemPrompt as string).includes("campaign optimization"));
});