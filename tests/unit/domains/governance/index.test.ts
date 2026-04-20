import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  DivisionRoleDefinition,
  LoadedDivisionDefinition,
  DivisionRegistry,
  DivisionLoaderOptions,
} from "../../../../src/domains/governance/division-loader.js";

test("DivisionRoleDefinition structure is correct", () => {
  const role: DivisionRoleDefinition = {
    id: "coder",
    name: "Coder",
    promptPath: "/divisions/coder/prompt.txt",
    promptText: "You are a coder agent.",
    model: "balanced",
    tools: ["read", "edit", "write"],
    maxInstances: null,
  };
  assert.equal(role.id, "coder");
  assert.equal(role.model, "balanced");
  assert.deepEqual(role.tools, ["read", "edit", "write"]);
  assert.equal(role.maxInstances, null);
});

test("LoadedDivisionDefinition structure is correct", () => {
  const division: LoadedDivisionDefinition = {
    id: "engineering",
    version: "1.0.0",
    name: "Engineering Division",
    description: "Handles engineering tasks",
    priority: 100,
    triggers: ["engineering.*"],
    defaultWorkflowId: "engineering wf",
    orchestrationWorkflowId: null,
    roles: [],
    workflows: [],
    rootPath: "/divisions/engineering",
  };
  assert.equal(division.id, "engineering");
  assert.equal(division.priority, 100);
  assert.equal(division.defaultWorkflowId, "engineering wf");
});

test("DivisionRegistry structure is correct", () => {
  const registry: DivisionRegistry = {
    divisions: new Map(),
    workflows: new Map(),
  };
  assert.ok(registry.divisions instanceof Map);
  assert.ok(registry.workflows instanceof Map);
});

test("DivisionLoaderOptions structure is correct", () => {
  const options: DivisionLoaderOptions = {
    divisionsRoot: "/divisions",
    allowCrossDivisionDag: true,
  };
  assert.equal(options.divisionsRoot, "/divisions");
  assert.equal(options.allowCrossDivisionDag, true);
});

test("DivisionLoaderOptions with sandbox policy", () => {
  const options: DivisionLoaderOptions = {
    divisionsRoot: "/divisions",
    sandboxPolicy: {
      policyId: "sandbox_1",
      mode: "read_only",
      allowedRoots: ["/allowed"],
      deniedRoots: [],
      realpathEnforced: true,
      symlinkPolicy: "deny",
      processRuleMode: "deny",
    },
  };
  assert.ok(options.sandboxPolicy !== undefined);
  assert.deepEqual(options.sandboxPolicy.allowedRoots, ["/allowed"]);
});
