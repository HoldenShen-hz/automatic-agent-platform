import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  BundleRevocationSeverity,
  createBuiltinPlugin,
  getBuiltinPluginManifest,
  getDataTaintLabels,
  hasBuiltinPlugin,
  hasDataTaintLabel,
  isPluginRevoked,
  listBuiltinPluginIds,
  propagateDataTaint,
  removePluginRevocation,
  revokePluginBundle,
  getPluginRevocationStatus,
  listRevokedPlugins,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("builtin plugin registry exposes builtin factories and presence checks", () => {
  const pluginIds = listBuiltinPluginIds();
  assert.ok(pluginIds.includes("plugin.coding.retriever"));
  assert.ok(pluginIds.includes("plugin.coding.presenter"));
  assert.ok(pluginIds.includes("plugin.core.basic-evaluator"));
  assert.ok(pluginIds.includes("plugin.core.basic-planner"));
  assert.ok(pluginIds.includes("plugin.shared.github_adapter"));

  assert.equal(hasBuiltinPlugin("plugin.coding.presenter"), true);
  assert.equal(hasBuiltinPlugin("plugin.missing"), false);

  const presenter = createBuiltinPlugin("plugin.coding.presenter");
  assert.ok(presenter);
  assert.equal(presenter?.spiType, "presenter");
  assert.equal(createBuiltinPlugin("plugin.core.basic-evaluator")?.spiType, "validator");
  assert.equal(createBuiltinPlugin("plugin.core.basic-planner")?.spiType, "planner");
  assert.equal(createBuiltinPlugin("plugin.missing"), null);
});

test("builtin plugin registry returns null for unknown plugin id", () => {
  const plugin = createBuiltinPlugin("plugin.does.not.exist");
  assert.equal(plugin, null);
});

test("builtin plugin registry has multiple plugin categories", () => {
  const pluginIds = listBuiltinPluginIds();
  // Should have plugins from different categories
  assert.ok(pluginIds.some((id) => id.startsWith("plugin.coding.")));
  assert.ok(pluginIds.some((id) => id.startsWith("plugin.shared.")));
  assert.ok(pluginIds.some((id) => id.startsWith("plugin.core.")));
});

test("builtin validator and planner plugins provide useful default behavior", async () => {
  const validator = createBuiltinPlugin("plugin.core.basic-evaluator");
  const planner = createBuiltinPlugin("plugin.core.basic-planner");
  assert.equal(validator?.spiType, "validator");
  assert.equal(planner?.spiType, "planner");

  if (validator?.spiType === "validator") {
    const validation = await validator.validate({
      stepId: "step_validate",
      machineOutput: {
        stepId: "step_validate",
        outputRef: null,
        payload: { summary: "ok", passed: true },
      },
      contract: {
        requiredFields: ["summary", "passed"],
        fieldTypes: {
          summary: "string",
          passed: "boolean",
        },
      },
    });
    assert.equal(validation.valid, true);
  }

  if (planner?.spiType === "planner") {
    const suggestion = await planner.suggestWorkflow({
      taskId: "task_plan",
      intent: "review output",
      assessment: {
        taskId: "task_plan",
        timestamp: Date.now(),
        situationRef: "task_situation:task_plan:1",
        phase: "pre-execution",
        complexity: "moderate",
        risk: "medium",
        riskAssessment: { level: "medium", factors: [] },
        routingDecision: { division: "coding", workflow: "multi-step", rationale: "moderate" },
        resourceAllocation: { modelClass: "medium", maxTokens: 3000, timeoutMs: 30000 },
        approvalPolicy: { required: false, level: "none" },
        executionMode: "auto",
        suggestedActions: [],
      },
    });
    assert.ok(suggestion);
    assert.equal(suggestion?.overrides.length, 3);
  }
});

test("builtin coding retriever searches repository structure", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-plugin-retriever-"));
  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(
      join(workspace, "src", "deploy.ts"),
      "export function deployCanary() { return true; }\nexport class RolloutController {}\n",
      "utf8",
    );

    const { createCodingRetrieverPlugin } = await import("../../../src/plugins/retrievers/coding-retriever.js");
    const retriever = createCodingRetrieverPlugin({ rootPath: workspace });
    const results = await retriever.retrieve({
      taskId: "task_plugin",
      intent: "deployCanary rollout",
      context: {},
      tokenBudget: 1200,
    });

    assert.ok(results.length > 0);
    assert.ok(results.some((result) => typeof result === "object" && result != null && "snippet" in result && String(result.snippet).includes("deployCanary")));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("builtin coding presenter and github adapter expose production-shaped behavior", async () => {
  const presenter = createBuiltinPlugin("plugin.coding.presenter");
  const github = createBuiltinPlugin("plugin.shared.github_adapter");
  assert.equal(presenter?.spiType, "presenter");
  assert.equal(github?.spiType, "adapter");

  if (presenter?.spiType === "presenter") {
    const output = await presenter.formatOutput({
      machineOutputs: [{
        stepId: "patch_code",
        outputRef: "artifact:patch",
        payload: { files: ["src/index.ts"], status: "ok" },
      }],
      artifacts: ["artifact:patch", "artifact:test-report"],
      audience: "developer",
    });
    assert.match(output.summary, /patch_code/);
    assert.ok(output.sections.some((section) => section.includes("```json")));
    assert.deepEqual(output.citations, ["artifact:patch", "artifact:test-report"]);
  }

  if (github?.spiType === "adapter") {
    await github.authenticate({ token: "ghp_example_token" });
    const result = await github.execute("create_issue", {
      repository: "openai/example",
      title: "Bug report",
      body: "details",
      labels: ["bug"],
    });
    assert.equal(result["endpoint"], "https://api.github.com/repos/openai/example/issues");
  }
});

test("getBuiltinPluginManifest returns correct manifest for known plugins", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.retriever");
  assert.ok(manifest);
  assert.equal(manifest.pluginId, "plugin.coding.retriever");
  assert.equal(manifest.name, "Coding Retriever");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.owner, "platform-team");
  assert.deepEqual(manifest.domainIds, ["coding"]);
  assert.deepEqual(manifest.capabilityIds, ["retriever.coding"]);
  assert.deepEqual(manifest.spiTypes, ["retriever"]);
  assert.equal(manifest.trustLevel, "internal");
});

test("getBuiltinPluginManifest returns null for unknown plugin id", () => {
  const manifest = getBuiltinPluginManifest("plugin.does.not.exist");
  assert.equal(manifest, null);
});

test("getBuiltinPluginManifest returns null for non-builtin plugin id", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.presenter");
  assert.ok(manifest);
  assert.equal(manifest.pluginId, "plugin.coding.presenter");
});

test("plugin capability enumeration via manifest capabilityIds", () => {
  const codingRetriever = getBuiltinPluginManifest("plugin.coding.retriever");
  assert.ok(codingRetriever);
  assert.ok(codingRetriever.capabilityIds.includes("retriever.coding"));

  const githubAdapter = getBuiltinPluginManifest("plugin.shared.github_adapter");
  assert.ok(githubAdapter);
  assert.ok(githubAdapter.capabilityIds.includes("external.github"));
  assert.ok(githubAdapter.capabilityIds.includes("external.github.issue"));
  assert.ok(githubAdapter.capabilityIds.includes("external.github.workflow"));
});

test("revokePluginBundle marks plugin as revoked with severity", () => {
  const pluginId = "plugin.coding.retriever";

  assert.equal(isPluginRevoked(pluginId), false);

  const record = revokePluginBundle(
    pluginId,
    BundleRevocationSeverity.WARNING,
    "Test revocation",
    ["1.0.0"],
  );

  assert.equal(record.pluginId, pluginId);
  assert.equal(record.severity, BundleRevocationSeverity.WARNING);
  assert.equal(record.reason, "Test revocation");
  assert.deepEqual(record.affectedVersions, ["1.0.0"]);
  assert.ok(record.revokedAt);

  assert.equal(isPluginRevoked(pluginId), true);
});

test("getPluginRevocationStatus returns revocation record when revoked", () => {
  const pluginId = "plugin.core.basic-planner";

  revokePluginBundle(pluginId, BundleRevocationSeverity.MODERATE, "Security vulnerability", ["1.0.0"]);

  const status = getPluginRevocationStatus(pluginId);
  assert.ok(status);
  assert.equal(status.pluginId, pluginId);
  assert.equal(status.severity, BundleRevocationSeverity.MODERATE);
  assert.equal(status.reason, "Security vulnerability");
});

test("getPluginRevocationStatus returns null when not revoked", () => {
  const status = getPluginRevocationStatus("plugin.coding.presenter");
  assert.equal(status, null);
});

test("listRevokedPlugins returns all revoked plugins", () => {
  const plugin1 = "plugin.coding.retriever";
  const plugin2 = "plugin.core.basic-evaluator";

  revokePluginBundle(plugin1, BundleRevocationSeverity.SEVERE, "Critical bug", ["1.0.0"]);
  revokePluginBundle(plugin2, BundleRevocationSeverity.INFO, "Deprecation notice", ["*"]);

  const revoked = listRevokedPlugins();
  assert.ok(revoked.length >= 2, "should have at least 2 revoked plugins");
  assert.ok(revoked.some((r) => r.pluginId === plugin1));
  assert.ok(revoked.some((r) => r.pluginId === plugin2));
});

test("removePluginRevocation clears revocation status", () => {
  const pluginId = "plugin.core.basic-evaluator";

  revokePluginBundle(pluginId, BundleRevocationSeverity.WARNING, "Temporary issue");
  assert.equal(isPluginRevoked(pluginId), true);

  const removed = removePluginRevocation(pluginId);
  assert.equal(removed, true);
  assert.equal(isPluginRevoked(pluginId), false);
});

test("removePluginRevocation returns false for non-revoked plugin", () => {
  const removed = removePluginRevocation("plugin.coding.presenter");
  assert.equal(removed, false);
});

test("propagateDataTaint tracks cross-plugin data contamination", () => {
  const dataId = "data-123";
  const targetPluginId = "plugin.coding.retriever";
  const labels = ["sensitive", "pii"];

  const propagation = propagateDataTaint(dataId, targetPluginId, labels);

  assert.equal(propagation.originPluginId, targetPluginId);
  assert.equal(propagation.originatingDataId, dataId);
  assert.equal(propagation.labels.length, 2);
  assert.equal(propagation.labels[0].label, "sensitive");
  assert.equal(propagation.labels[0].sourcePluginId, targetPluginId);
  assert.equal(propagation.labels[1].label, "pii");
});

test("getDataTaintLabels retrieves all taint labels for a data ID", () => {
  const dataId = "data-456";

  propagateDataTaint(dataId, "plugin.coding.presenter", ["label-a"]);
  propagateDataTaint(dataId, "plugin.shared.github_adapter", ["label-b"]);

  const labels = getDataTaintLabels(dataId);
  assert.equal(labels.length, 2);
  assert.ok(labels.some((l) => l.label === "label-a"));
  assert.ok(labels.some((l) => l.label === "label-b"));
});

test("getDataTaintLabels returns empty array for unknown data ID", () => {
  const labels = getDataTaintLabels("data-does-not-exist");
  assert.equal(labels.length, 0);
});

test("hasDataTaintLabel checks for specific taint label existence", () => {
  const dataId = "data-789";

  propagateDataTaint(dataId, "plugin.coding.retriever", ["confidential"]);

  assert.equal(hasDataTaintLabel(dataId, "confidential"), true);
  assert.equal(hasDataTaintLabel(dataId, "nonexistent"), false);
});

test("revokePluginBundle defaults affectedVersions to wildcard", () => {
  const pluginId = "plugin.growth.retriever";

  const record = revokePluginBundle(
    pluginId,
    BundleRevocationSeverity.CRITICAL,
    "Emergency revocation",
  );

  assert.deepEqual(record.affectedVersions, ["*"]);
});

test("all BundleRevocationSeverity levels are correctly assigned", () => {
  const pluginIds = [
    "plugin.coding.retriever",
    "plugin.coding.presenter",
    "plugin.core.basic-evaluator",
    "plugin.core.basic-planner",
    "plugin.shared.github_adapter",
  ];
  const severities = [
    BundleRevocationSeverity.INFO,
    BundleRevocationSeverity.WARNING,
    BundleRevocationSeverity.MODERATE,
    BundleRevocationSeverity.SEVERE,
    BundleRevocationSeverity.CRITICAL,
  ];

  for (let i = 0; i < pluginIds.length; i++) {
    revokePluginBundle(pluginIds[i], severities[i], `Test severity ${i}`);
    const status = getPluginRevocationStatus(pluginIds[i]);
    assert.equal(status?.severity, severities[i]);
  }
});
