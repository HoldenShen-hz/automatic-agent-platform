import test from "node:test";
import assert from "node:assert/strict";
import { operationsDomainDefinition } from "../../../src/plugins/operations-config.js";
test("operationsDomainDefinition exports valid structure", () => {
    assert.equal(operationsDomainDefinition.domainId, "operations");
    assert.equal(operationsDomainDefinition.name, "Operations");
    assert.equal(operationsDomainDefinition.version, 1);
    assert.equal(operationsDomainDefinition.status, "active");
});
test("operationsDomainDefinition has three workflows", () => {
    assert.equal(operationsDomainDefinition.workflows.length, 3);
    const workflowIds = operationsDomainDefinition.workflows.map((w) => w.workflowId);
    assert.ok(workflowIds.includes("incident_response"));
    assert.ok(workflowIds.includes("runbook_execution"));
    assert.ok(workflowIds.includes("monitoring_review"));
});
test("incident_response workflow has correct structure", () => {
    const workflow = operationsDomainDefinition.workflows.find((w) => w.workflowId === "incident_response");
    assert.equal(workflow.name, "Incident Response");
    assert.deepEqual(workflow.triggerConditions, { taskType: "incident" });
    assert.equal(workflow.steps.length, 2);
    assert.equal(workflow.steps[0].stepName, "assess_incident");
    assert.equal(workflow.steps[1].stepName, "apply_remediation");
    assert.equal(workflow.steps[0].requiresReview, true);
    assert.equal(workflow.steps[1].requiresReview, true);
    assert.equal(workflow.steps[1].retryPolicy.maxRetries, 2);
});
test("runbook_execution workflow has correct structure", () => {
    const workflow = operationsDomainDefinition.workflows.find((w) => w.workflowId === "runbook_execution");
    assert.equal(workflow.name, "Runbook Execution");
    assert.deepEqual(workflow.triggerConditions, { taskType: "runbook" });
    assert.equal(workflow.steps.length, 2);
    assert.equal(workflow.steps[0].stepName, "retrieve_runbook");
    assert.equal(workflow.steps[1].stepName, "execute_runbook");
    assert.equal(workflow.steps[0].requiresReview, false);
    assert.equal(workflow.steps[1].requiresReview, false);
});
test("monitoring_review workflow has correct structure", () => {
    const workflow = operationsDomainDefinition.workflows.find((w) => w.workflowId === "monitoring_review");
    assert.equal(workflow.name, "Monitoring Review");
    assert.deepEqual(workflow.triggerConditions, { taskType: "monitoring" });
    assert.equal(workflow.steps.length, 2);
    assert.equal(workflow.steps[0].stepName, "fetch_metrics");
    assert.equal(workflow.steps[1].stepName, "summarize_findings");
});
test("operationsDomainDefinition has ops-core tool bundle", () => {
    const bundle = operationsDomainDefinition.toolBundles.find((b) => b.bundleId === "ops-core");
    assert.ok(bundle !== undefined);
    assert.ok(bundle.tools.some((t) => t.toolName === "diagnose"));
    assert.ok(bundle.tools.some((t) => t.toolName === "fetch_logs"));
    assert.ok(bundle.tools.some((t) => t.toolName === "execute"));
    const patchTool = bundle.tools.find((t) => t.toolName === "patch");
    assert.equal(patchTool.enabled, false);
});
test("operationsDomainDefinition has two output contracts", () => {
    assert.equal(operationsDomainDefinition.outputContracts.length, 2);
    const contractIds = operationsDomainDefinition.outputContracts.map((c) => c.contractId);
    assert.ok(contractIds.includes("ops.incident_response"));
    assert.ok(contractIds.includes("ops.runbook_execution"));
});
test("operationsDomainDefinition output contracts have correct validation levels", () => {
    const incident = operationsDomainDefinition.outputContracts.find((c) => c.contractId === "ops.incident_response");
    assert.equal(incident.validationLevel, "strict");
    const runbook = operationsDomainDefinition.outputContracts.find((c) => c.contractId === "ops.runbook_execution");
    assert.equal(runbook.validationLevel, "lenient");
});
test("operationsDomainDefinition has correct capabilities", () => {
    assert.ok(operationsDomainDefinition.capabilities.supportedTaskTypes.includes("incident"));
    assert.ok(operationsDomainDefinition.capabilities.supportedTaskTypes.includes("runbook"));
    assert.ok(operationsDomainDefinition.capabilities.supportedTaskTypes.includes("monitoring"));
    assert.ok(operationsDomainDefinition.capabilities.requiredTools.includes("diagnose"));
    assert.ok(operationsDomainDefinition.capabilities.requiredTools.includes("fetch_logs"));
});
test("operationsDomainDefinition has correct model preferences", () => {
    assert.equal(operationsDomainDefinition.capabilities.modelPreferences["incident_response"], "claude-sonnet");
    assert.equal(operationsDomainDefinition.capabilities.modelPreferences["runbook_execution"], "claude-haiku");
});
test("operationsDomainDefinition has correct budget limits", () => {
    assert.equal(operationsDomainDefinition.capabilities.budgetLimits.maxTokensPerTask, 6000);
    assert.equal(operationsDomainDefinition.capabilities.budgetLimits.maxCostPerTask, 2.0);
});
test("operationsDomainDefinition has elevated security level", () => {
    assert.equal(operationsDomainDefinition.capabilities.securityLevel, "elevated");
});
test("operationsDomainDefinition has external adapters", () => {
    assert.ok(operationsDomainDefinition.externalAdapters.includes("github"));
});
test("operationsDomainDefinition has plugin bindings", () => {
    assert.equal(operationsDomainDefinition.pluginBindings.length, 4);
    const bindingIds = operationsDomainDefinition.pluginBindings.map((b) => b.bindingId);
    assert.ok(bindingIds.includes("ops.retriever"));
    assert.ok(bindingIds.includes("ops.presenter"));
    assert.ok(bindingIds.includes("ops.validator"));
    assert.ok(bindingIds.includes("ops.planner"));
});
test("operations validator plugin binding uses core basic-evaluator", () => {
    const binding = operationsDomainDefinition.pluginBindings.find((b) => b.bindingId === "ops.validator");
    assert.ok(binding !== undefined);
    assert.equal(binding.pluginId, "plugin.core.basic-evaluator");
    assert.equal(binding.pluginType, "validator");
    assert.equal(binding.priority, 5);
    assert.equal(binding.enabled, true);
});
test("operations planner plugin binding uses core basic-planner", () => {
    const binding = operationsDomainDefinition.pluginBindings.find((b) => b.bindingId === "ops.planner");
    assert.ok(binding !== undefined);
    assert.equal(binding.pluginId, "plugin.core.basic-planner");
    assert.equal(binding.pluginType, "planner");
    assert.equal(binding.priority, 1);
    assert.equal(binding.enabled, true);
});
test("operationsDomainDefinition has prompt overrides", () => {
    const systemPrompt = operationsDomainDefinition.promptOverrides["system"];
    assert.ok(systemPrompt);
    assert.ok(systemPrompt.includes("Operations AI"));
    assert.ok(systemPrompt.includes("SRE"));
});
test("operations incident_response step dependencies", () => {
    const workflow = operationsDomainDefinition.workflows.find((w) => w.workflowId === "incident_response");
    const assessStep = workflow.steps.find((s) => s.stepName === "assess_incident");
    const remediateStep = workflow.steps.find((s) => s.stepName === "apply_remediation");
    assert.deepEqual(assessStep.dependsOn, []);
    assert.deepEqual(remediateStep.dependsOn, ["assess_incident"]);
});
test("operations runbook_execution step dependencies", () => {
    const workflow = operationsDomainDefinition.workflows.find((w) => w.workflowId === "runbook_execution");
    const retrieveStep = workflow.steps.find((s) => s.stepName === "retrieve_runbook");
    const executeStep = workflow.steps.find((s) => s.stepName === "execute_runbook");
    assert.deepEqual(retrieveStep.dependsOn, []);
    assert.deepEqual(executeStep.dependsOn, ["retrieve_runbook"]);
});
//# sourceMappingURL=operations-config.test.js.map