import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DivisionLoader, loadConfiguredDivisionRegistry } from "../../../../src/domains/governance/division-loader.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";

function seedDivisionTree(root: string): void {
  createFile(join(root, "general_ops/schemas/minimal-output.json"), JSON.stringify({
    type: "object",
    required: ["summary", "result"],
    properties: {
      summary: { type: "string", minLength: 1 },
      result: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  }));
  createFile(
    join(root, "general_ops/division.yaml"),
    [
      "id: general_ops",
      "version: 1",
      "name: General Operations",
      "default_workflow: single_agent_minimal",
      "orchestration_workflow: single_division_multi_step_orchestration",
      "triggers:",
      "  - summarize",
      "roles:",
      "  - id: general_executor",
      "    prompt: roles/general_executor.prompt.md",
      "    model: balanced",
      "    tools: [read, bash]",
    ].join("\n"),
  );
  createFile(join(root, "general_ops/roles/general_executor.prompt.md"), "# general\n");
  createFile(
    join(root, "general_ops/workflows/minimal.yaml"),
    [
      "id: single_agent_minimal",
      "division_id: general_ops",
      "steps:",
      "  - step_id: analyze_request",
      "    role_id: general_executor",
      "    output_key: analysis",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 120000",
      "    max_attempts: 1",
    ].join("\n"),
  );
  createFile(
    join(root, "general_ops/workflows/orchestration.yaml"),
    [
      "id: single_division_multi_step_orchestration",
      "division_id: general_ops",
      "steps:",
      "  - step_id: intake_triage",
      "    role_id: general_executor",
      "    output_key: triage",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 60000",
      "    max_attempts: 1",
      "  - step_id: draft_solution",
      "    role_id: general_executor",
      "    output_key: draft",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 180000",
      "    max_attempts: 2",
      "    depends_on: [intake_triage]",
    ].join("\n"),
  );

  createFile(join(root, "engineering_ops/schemas/minimal-output.json"), JSON.stringify({
    type: "object",
    required: ["summary", "result"],
    properties: {
      summary: { type: "string", minLength: 1 },
      result: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  }));
  createFile(
    join(root, "engineering_ops/division.yaml"),
    [
      "id: engineering_ops",
      "version: 1",
      "name: Engineering Operations",
      "default_workflow: engineering_single_agent_minimal",
      "orchestration_workflow: engineering_multi_step_delivery",
      "priority: 50",
      "triggers:",
      "  - code",
      "  - implement",
      "  - fix",
      "roles:",
      "  - id: engineer",
      "    prompt: roles/engineer.prompt.md",
      "    model: coding",
      "    tools: [read, edit, bash]",
      "  - id: reviewer",
      "    prompt: roles/reviewer.prompt.md",
      "    model: reasoning",
      "    tools: [read]",
    ].join("\n"),
  );
  createFile(join(root, "engineering_ops/roles/engineer.prompt.md"), "# engineer\n");
  createFile(join(root, "engineering_ops/roles/reviewer.prompt.md"), "# reviewer\n");
  createFile(
    join(root, "engineering_ops/workflows/minimal.yaml"),
    [
      "id: engineering_single_agent_minimal",
      "division_id: engineering_ops",
      "steps:",
      "  - step_id: implement_request",
      "    role_id: engineer",
      "    output_key: implementation",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 120000",
      "    max_attempts: 1",
    ].join("\n"),
  );
  createFile(
    join(root, "engineering_ops/workflows/orchestration.yaml"),
    [
      "id: engineering_multi_step_delivery",
      "division_id: engineering_ops",
      "steps:",
      "  - step_id: analyze_request",
      "    role_id: engineer",
      "    output_key: implementation_plan",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 120000",
      "    max_attempts: 1",
      "  - step_id: implement_changes",
      "    role_id: engineer",
      "    output_key: code_changes",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 180000",
      "    max_attempts: 2",
      "    depends_on: [analyze_request]",
      "  - step_id: review_changes",
      "    role_id: reviewer",
      "    output_key: review_summary",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 90000",
      "    max_attempts: 1",
      "    depends_on: [implement_changes]",
    ].join("\n"),
  );
}

function seedWorkflowConfig(root: string, allowCrossDivisionDag: boolean): void {
  createFile(
    join(root, "workflows/default.json"),
    JSON.stringify(
      {
        defaultWorkflowId: "single_agent_minimal",
        allowCrossDivisionDag,
      },
      null,
      2,
    ),
  );
}

test("division loader loads multiple divisions, prompts, and workflows", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    const registry = new DivisionLoader({
      divisionsRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    }).loadAll();

    assert.equal(registry.divisions.size, 2);
    assert.ok(registry.divisions.has("general_ops"));
    assert.ok(registry.divisions.has("engineering_ops"));
    assert.ok(registry.workflows.has("engineering_multi_step_delivery"));
    assert.equal(
      registry.workflows.get("engineering_multi_step_delivery")?.steps[2]?.roleId,
      "reviewer",
    );
    assert.equal(
      registry.workflows.get("single_agent_minimal")?.steps[0]?.outputSchemaPath?.endsWith(
        "general_ops/schemas/minimal-output.json",
      ),
      true,
    );
    assert.match(
      registry.divisions.get("engineering_ops")?.roles[0]?.promptText ?? "",
      /engineer/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("division loader rejects workflows that reference undefined roles", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    createFile(
      join(divisionsRoot, "engineering_ops/workflows/orchestration.yaml"),
      [
        "id: engineering_multi_step_delivery",
        "division_id: engineering_ops",
        "steps:",
        "  - step_id: analyze_request",
        "    role_id: missing_role",
        "    output_key: implementation_plan",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
      ].join("\n"),
    );

    assert.throws(
      () =>
        new DivisionLoader({
          divisionsRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
        }).loadAll(),
      /workflow\.role_missing/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("division loader accepts cross-division workflow steps when explicitly enabled", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    createFile(
      join(divisionsRoot, "general_ops/workflows/cross-division.yaml"),
      [
        "id: cross_division_delivery",
        "division_id: general_ops",
        "steps:",
        "  - step_id: intake",
        "    role_id: general_executor",
        "    output_key: triage",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: implement",
        "    division_id: engineering_ops",
        "    role_id: engineer",
        "    input_keys: [triage]",
        "    output_key: implementation_plan",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "    depends_on: [intake]",
      ].join("\n"),
    );

    const registry = new DivisionLoader({
      divisionsRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      allowCrossDivisionDag: true,
    }).loadAll();

    assert.equal(
      registry.workflows.get("cross_division_delivery")?.steps[1]?.divisionId,
      "engineering_ops",
    );
    assert.deepEqual(
      registry.workflows.get("cross_division_delivery")?.steps[1]?.inputKeys,
      ["triage"],
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("division loader rejects cross-division workflow steps when the DAG feature is disabled", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    createFile(
      join(divisionsRoot, "general_ops/workflows/cross-division.yaml"),
      [
        "id: cross_division_delivery",
        "division_id: general_ops",
        "steps:",
        "  - step_id: intake",
        "    role_id: general_executor",
        "    output_key: triage",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: implement",
        "    division_id: engineering_ops",
        "    role_id: engineer",
        "    input_keys: [triage]",
        "    output_key: implementation_plan",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "    depends_on: [intake]",
      ].join("\n"),
    );

    assert.throws(
      () =>
        new DivisionLoader({
          divisionsRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
        }).loadAll(),
      /workflow\.cross_division_disabled/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("configured division registry loader honors the cross-division DAG config flag", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");
  const configRoot = join(workspace, "config");

  try {
    seedDivisionTree(divisionsRoot);
    seedWorkflowConfig(configRoot, true);
    createFile(
      join(divisionsRoot, "general_ops/workflows/cross-division.yaml"),
      [
        "id: cross_division_delivery",
        "division_id: general_ops",
        "steps:",
        "  - step_id: intake",
        "    role_id: general_executor",
        "    output_key: triage",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: implement",
        "    division_id: engineering_ops",
        "    role_id: engineer",
        "    input_keys: [triage]",
        "    output_key: implementation_plan",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "    depends_on: [intake]",
      ].join("\n"),
    );

    const registry = loadConfiguredDivisionRegistry({
      configRoot,
      divisionsRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.equal(
      registry.workflows.get("cross_division_delivery")?.steps[1]?.divisionId,
      "engineering_ops",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("division loader rejects orphan workflow steps that are disconnected from the DAG", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    createFile(
      join(divisionsRoot, "general_ops/workflows/orphan.yaml"),
      [
        "id: orphan_workflow",
        "division_id: general_ops",
        "steps:",
        "  - step_id: intake",
        "    role_id: general_executor",
        "    output_key: triage",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: isolated",
        "    role_id: general_executor",
        "    output_key: isolated_output",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
      ].join("\n"),
    );

    assert.throws(
      () =>
        new DivisionLoader({
          divisionsRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
        }).loadAll(),
      /workflow\.orphaned_step/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("division loader rejects disconnected workflow components that never join the main DAG", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    createFile(
      join(divisionsRoot, "general_ops/workflows/disconnected.yaml"),
      [
        "id: disconnected_workflow",
        "division_id: general_ops",
        "steps:",
        "  - step_id: intake",
        "    role_id: general_executor",
        "    output_key: triage",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: draft",
        "    role_id: general_executor",
        "    output_key: draft_output",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "    depends_on: [intake]",
        "  - step_id: side_a",
        "    role_id: general_executor",
        "    output_key: side_a_output",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: side_b",
        "    role_id: general_executor",
        "    output_key: side_b_output",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "    depends_on: [side_a]",
      ].join("\n"),
    );

    assert.throws(
      () =>
        new DivisionLoader({
          divisionsRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
        }).loadAll(),
      /workflow\.disconnected_step/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("division loader rejects cross-division workflow steps that reference a missing division", () => {
  const workspace = createTempWorkspace("aa-divisions-");
  const divisionsRoot = join(workspace, "divisions");

  try {
    seedDivisionTree(divisionsRoot);
    createFile(
      join(divisionsRoot, "general_ops/workflows/cross-division-missing-division.yaml"),
      [
        "id: cross_division_missing_division",
        "division_id: general_ops",
        "steps:",
        "  - step_id: intake",
        "    role_id: general_executor",
        "    output_key: triage",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "  - step_id: implement",
        "    division_id: missing_ops",
        "    role_id: engineer",
        "    input_keys: [triage]",
        "    output_key: implementation_plan",
        "    output_schema: schemas/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
        "    depends_on: [intake]",
      ].join("\n"),
    );

    assert.throws(
      () =>
        new DivisionLoader({
          divisionsRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspace),
          allowCrossDivisionDag: true,
        }).loadAll(),
      /workflow\.step_division_missing/,
    );
  } finally {
    cleanupPath(workspace);
  }
});
