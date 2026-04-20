import assert from "node:assert/strict";
import test from "node:test";

import type { DivisionRegistry } from "../../../../../src/domains/governance/division-loader.js";
import { RoleToolExposureService } from "../../../../../src/platform/execution/tool-executor/role-tool-exposure-service.js";

test("RoleToolExposureService resolves general executor tools without filtering", () => {
  const service = new RoleToolExposureService();
  const result = service.resolve({
    divisionId: "general_ops",
    roleId: "general_executor",
    taskContext: "Read the task details and inspect the current status.",
  });

  assert.deepEqual(result.declaredToolNames, ["read", "bash"]);
  assert.deepEqual(result.resolvedToolNames, ["read", "bash"]);
  assert.deepEqual(result.visibleToolNames, ["read", "bash"]);
  assert.deepEqual(result.deferredToolNames, []);
  assert.equal(result.wasFiltered, false);
});

test("RoleToolExposureService applies deferred loading to larger engineering tool surfaces", () => {
  const service = new RoleToolExposureService();
  const result = service.resolve({
    divisionId: "engineering_ops",
    roleId: "engineer",
    taskContext: "Implement the code fix, apply a patch, and verify the result with bash.",
  });

  assert.deepEqual(
    result.resolvedToolNames,
    ["read", "edit_replace", "edit_batch", "apply_patch", "bash"],
  );
  assert.equal(result.wasFiltered, true);
  assert.equal(result.visibleToolNames.length, 4);
  assert.equal(result.deferredToolNames.length, 1);
  assert.ok(result.visibleToolNames.includes("apply_patch"));
});

test("RoleToolExposureService fail-closes unknown declared tool aliases", () => {
  const registry: DivisionRegistry = {
    divisions: new Map([
      ["custom_ops", {
        id: "custom_ops",
        version: "1",
        name: "Custom Ops",
        description: "test",
        priority: 1,
        triggers: [],
        defaultWorkflowId: "single_agent_minimal",
        orchestrationWorkflowId: null,
        roles: [{
          id: "operator",
          name: "Operator",
          promptPath: "/tmp/operator.prompt.md",
          promptText: "# operator",
          model: "balanced",
          tools: ["unknown_magic_tool"],
          maxInstances: 1,
        }],
        workflows: [],
        rootPath: "/tmp/custom_ops",
      }],
    ]),
    workflows: new Map(),
  };
  const service = new RoleToolExposureService(registry);

  assert.throws(
    () => service.resolve({
      divisionId: "custom_ops",
      roleId: "operator",
      taskContext: "Investigate the task.",
    }),
    /tool\.role_declared_tool_unknown:custom_ops:operator:unknown_magic_tool/,
  );
});
