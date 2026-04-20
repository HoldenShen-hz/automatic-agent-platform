import assert from "node:assert/strict";
import test from "node:test";

import type {
  DivisionRoleDefinition,
  LoadedDivisionDefinition,
  DivisionRegistry,
  DivisionLoaderOptions,
  ConfiguredDivisionRegistryOptions,
} from "../../../../src/domains/governance/division-loader.js";

test("DivisionRoleDefinition structure is correct", () => {
  const role: DivisionRoleDefinition = {
    id: "role_executor",
    name: "Task Executor",
    promptPath: "/divisions/executor/prompt.txt",
    promptText: "You are a task execution agent.",
    model: "balanced",
    tools: ["code_execution", "web_search", "file_write"],
    maxInstances: 10,
  };

  assert.equal(role.id, "role_executor");
  assert.equal(role.name, "Task Executor");
  assert.equal(role.model, "balanced");
  assert.equal(role.tools.length, 3);
  assert.equal(role.maxInstances, 10);
});

test("DivisionRoleDefinition allows null maxInstances", () => {
  const role: DivisionRoleDefinition = {
    id: "role_unlimited",
    name: "Unlimited Role",
    promptPath: "/divisions/unlimited/prompt.txt",
    promptText: "Unlimited concurrent instances allowed.",
    model: "precision",
    tools: ["analysis"],
    maxInstances: null,
  };

  assert.equal(role.maxInstances, null);
});

test("LoadedDivisionDefinition structure is correct", () => {
  const division: LoadedDivisionDefinition = {
    id: "division_abc",
    version: "1.0.0",
    name: "Alpha Division",
    description: "Primary division for task execution",
    priority: 100,
    triggers: ["alpha:", "primary:"],
    defaultWorkflowId: "wf_default",
    orchestrationWorkflowId: "wf_orchestrate",
    roles: [],
    workflows: [],
    rootPath: "/divisions/abc",
  };

  assert.equal(division.id, "division_abc");
  assert.equal(division.version, "1.0.0");
  assert.equal(division.priority, 100);
  assert.equal(division.triggers.length, 2);
  assert.equal(division.orchestrationWorkflowId, "wf_orchestrate");
});

test("LoadedDivisionDefinition allows null orchestrationWorkflowId", () => {
  const division: LoadedDivisionDefinition = {
    id: "division_simple",
    version: "1.0.0",
    name: "Simple Division",
    description: "Single workflow division",
    priority: 50,
    triggers: ["simple:"],
    defaultWorkflowId: "wf_single",
    orchestrationWorkflowId: null,
    roles: [],
    workflows: [],
    rootPath: "/divisions/simple",
  };

  assert.equal(division.orchestrationWorkflowId, null);
});

test("LoadedDivisionDefinition allows empty roles and workflows", () => {
  const division: LoadedDivisionDefinition = {
    id: "division_empty",
    version: "1.0.0",
    name: "Empty Division",
    description: "Division with no roles or workflows",
    priority: 0,
    triggers: [],
    defaultWorkflowId: "wf_empty",
    orchestrationWorkflowId: null,
    roles: [],
    workflows: [],
    rootPath: "/divisions/empty",
  };

  assert.equal(division.roles.length, 0);
  assert.equal(division.workflows.length, 0);
});

test("DivisionRegistry structure is correct", () => {
  const registry: DivisionRegistry = {
    divisions: new Map([["div_1", {
      id: "div_1",
      version: "1.0",
      name: "Division 1",
      description: "First division",
      priority: 1,
      triggers: ["div1:"],
      defaultWorkflowId: "wf_1",
      orchestrationWorkflowId: null,
      roles: [],
      workflows: [],
      rootPath: "/div/1",
    }]]),
    workflows: new Map([["wf_1", {
      workflowId: "wf_1",
      divisionId: "div_1",
      steps: [],
    }]]),
  };

  assert.equal(registry.divisions.size, 1);
  assert.equal(registry.workflows.size, 1);
});

test("DivisionRegistry allows empty maps", () => {
  const registry: DivisionRegistry = {
    divisions: new Map(),
    workflows: new Map(),
  };

  assert.equal(registry.divisions.size, 0);
  assert.equal(registry.workflows.size, 0);
});

test("DivisionLoaderOptions structure is correct", () => {
  const options: DivisionLoaderOptions = {
    divisionsRoot: "/var/divisions",
    allowCrossDivisionDag: true,
  };

  assert.equal(options.divisionsRoot, "/var/divisions");
  assert.equal(options.allowCrossDivisionDag, true);
});

test("DivisionLoaderOptions allows minimal definition", () => {
  const options: DivisionLoaderOptions = {};
  assert.equal(options.divisionsRoot, undefined);
  assert.equal(options.sandboxPolicy, undefined);
  assert.equal(options.allowCrossDivisionDag, undefined);
});

test("ConfiguredDivisionRegistryOptions structure is correct", () => {
  const options: ConfiguredDivisionRegistryOptions = {
    divisionsRoot: "/var/divisions",
    configRoot: "/var/config",
    environment: "production",
    allowCrossDivisionDag: false,
  };

  assert.equal(options.divisionsRoot, "/var/divisions");
  assert.equal(options.configRoot, "/var/config");
  assert.equal(options.environment, "production");
  assert.equal(options.allowCrossDivisionDag, false);
});

test("ConfiguredDivisionRegistryOptions allows minimal definition", () => {
  const options: ConfiguredDivisionRegistryOptions = {};
  assert.equal(options.divisionsRoot, undefined);
  assert.equal(options.configRoot, undefined);
  assert.equal(options.environment, undefined);
});

test("ConfiguredDivisionRegistryOptions extends DivisionLoaderOptions", () => {
  const options: ConfiguredDivisionRegistryOptions = {
    divisionsRoot: "/custom/divisions",
  };

  assert.equal(options.divisionsRoot, "/custom/divisions");
  // Inherited from DivisionLoaderOptions
  assert.equal(options.allowCrossDivisionDag, undefined);
});
