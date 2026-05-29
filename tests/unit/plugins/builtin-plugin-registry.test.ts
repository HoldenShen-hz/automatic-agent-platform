import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createBuiltinPlugin, hasBuiltinPlugin, listBuiltinPluginIds } from "../../../src/plugins/builtin-plugin-registry.js";

function createMockFetch(payload: Record<string, unknown> = { ok: true }): typeof fetch {
  return async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

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
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch({ issueId: 1, number: 1 });
  const presenter = createBuiltinPlugin("plugin.coding.presenter");
  const github = createBuiltinPlugin("plugin.shared.github_adapter");
  try {
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
