import assert from "node:assert/strict";
import test from "node:test";

import { createBasicEvaluatorPlugin } from "../../../../src/plugins/validators/basic-evaluator.js";
import { createBasicPlannerPlugin } from "../../../../src/plugins/planners/basic-planner.js";
import {
  createBuiltinPlugin,
  createBuiltinPluginWithManifest,
  getBuiltinPluginManifest,
  hasBuiltinPlugin,
  listBuiltinPluginIds,
  listBuiltinPluginManifests,
  recordPluginTaint,
  revokePluginBundle,
  getPluginRevocationStatus,
  removePluginRevocation,
  BundleRevocationSeverity,
} from "../../../../src/plugins/builtin-plugin-registry.js";
import type { UnifiedAssessment } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";

function makeAssessment(
  complexity: UnifiedAssessment["complexity"],
  risk: UnifiedAssessment["risk"],
  approvalRequired = false,
): UnifiedAssessment {
  return {
    taskId: "task-1",
    timestamp: 1,
    situationRef: "situation:1",
    phase: "pre-execution",
    complexity,
    risk,
    riskAssessment: { level: risk, factors: [] },
    routingDecision: {
      division: "coding",
      workflow: complexity === "trivial" || complexity === "simple" ? "single-step" : "multi-step",
      rationale: "test",
    },
    resourceAllocation: { modelClass: "medium", maxTokens: 1000, timeoutMs: 60_000 },
    approvalPolicy: { required: approvalRequired, level: approvalRequired ? "required" : "none" },
    executionMode: "auto",
    suggestedActions: [],
  };
}

test("basic evaluator validates required fields and emits harness decisions", async () => {
  const plugin = createBasicEvaluatorPlugin();

  const valid = await plugin.validate({
    machineOutput: { outputRef: null, payload: { name: "demo", score: 1 } },
    contract: { requiredFields: ["name"], fieldTypes: { name: "string", score: "number" } },
  });
  const invalid = await plugin.validate({
    machineOutput: { outputRef: null, payload: {} },
    contract: { requiredFields: ["name"], fieldTypes: { score: "number" } },
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.evaluation?.harnessDecision.action, "accept");
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 1);
  assert.ok(invalid.evaluation);
  assert.ok(invalid.evaluation.harnessDecision.reasonCodes.length > 0);
});

test("basic planner selects workflow overrides from assessment complexity", async () => {
  const plugin = createBasicPlannerPlugin();

  const trivial = await plugin.suggestWorkflow({
    taskId: "task-1",
    intent: "read a file",
    assessment: makeAssessment("trivial", "low"),
  });
  const moderate = await plugin.suggestWorkflow({
    taskId: "task-2",
    intent: "patch and review",
    assessment: makeAssessment("moderate", "high", true),
  });
  const critical = await plugin.suggestWorkflow({
    taskId: "task-3",
    intent: "dangerous task",
    assessment: makeAssessment("critical", "critical"),
  });

  assert.equal(trivial?.workflowId, "workflow.core.trivial");
  assert.equal(trivial?.overrides[0]?.stepName, "direct-execute");
  assert.equal(moderate?.workflowId, "workflow.core.moderate");
  assert.equal(moderate?.overrides[2]?.requiresReview, true);
  assert.equal(critical, null);
});

test("builtin plugin registry exposes known plugins and normalized manifests", () => {
  const pluginId = "plugin.core.basic-evaluator";

  assert.equal(hasBuiltinPlugin(pluginId), true);
  assert.ok(listBuiltinPluginIds().includes(pluginId));
  assert.ok(listBuiltinPluginManifests().some((manifest) => manifest.pluginId === pluginId));

  const plugin = createBuiltinPlugin(pluginId);
  const pluginWithManifest = createBuiltinPluginWithManifest(pluginId);
  const manifest = getBuiltinPluginManifest(pluginId);

  assert.ok(plugin);
  assert.ok(pluginWithManifest);
  assert.ok(manifest);
  assert.equal(plugin?.pluginId, pluginId);
  assert.equal(pluginWithManifest?.manifest.pluginId, pluginId);
  assert.ok(manifest?.publicSdkSurface.startsWith("@automatic-agent/"));
});

test("builtin plugin registry returns null for unknown plugin ids", () => {
  assert.equal(hasBuiltinPlugin("plugin.missing"), false);
  assert.equal(createBuiltinPlugin("plugin.missing"), null);
  assert.equal(createBuiltinPluginWithManifest("plugin.missing"), null);
  assert.equal(getBuiltinPluginManifest("plugin.missing"), null);
});

test("plugin taint and revocation helpers record current state", () => {
  const taintRecord = recordPluginTaint({
    pluginId: "plugin.core.basic-evaluator",
    inputDataClasses: ["internal"],
    outputDataClass: "internal",
    inputTaintLabels: [{
      label: "pii",
      severity: "high",
      sourcePluginId: "plugin.source",
      propagatedAt: new Date(0).toISOString(),
      propagationChain: ["input-1"],
    }],
  });

  const revocation = revokePluginBundle(
    "plugin.core.basic-evaluator",
    BundleRevocationSeverity.HIGH,
    "security issue",
    ["1.0.0"],
  );

  assert.equal(taintRecord.sourcePluginId, "plugin.core.basic-evaluator");
  assert.equal(taintRecord.taintLabels.length > 0, true);
  assert.equal(revocation.pluginId, "plugin.core.basic-evaluator");
  assert.equal(getPluginRevocationStatus("plugin.core.basic-evaluator")?.reason, "security issue");
  assert.equal(removePluginRevocation("plugin.core.basic-evaluator"), true);
  assert.equal(getPluginRevocationStatus("plugin.core.basic-evaluator"), null);
});
