import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DivisionLoader } from "../../../../src/domains/governance/division-loader.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

function seedDivision(root: string): void {
  createFile(join(root, "general-ops/schemas/minimal-output.json"), JSON.stringify({
    type: "object",
    required: ["summary", "result"],
    properties: {
      summary: { type: "string", minLength: 1 },
      result: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  }));
  createFile(
    join(root, "general-ops/division.yaml"),
    [
      "id: general-ops",
      "version: 1",
      "name: General Operations",
      "default_workflow: single_agent_minimal",
      "triggers:",
      "  - summarize",
      "roles:",
      "  - id: general_executor",
      "    prompt: roles/general_executor.prompt.md",
    ].join("\n"),
  );
  createFile(join(root, "general-ops/roles/general_executor.prompt.md"), "# general\n");
  createFile(
    join(root, "general-ops/workflows/minimal.yaml"),
    [
      "id: single_agent_minimal",
      "division_id: general-ops",
      "steps:",
      "  - step_id: analyze_request",
      "    role_id: general_executor",
      "    output_key: analysis",
      "    output_schema: schemas/minimal-output.json",
      "    timeout_ms: 120000",
      "    max_attempts: 1",
    ].join("\n"),
  );
}

test("division loader blocks division roots outside the workspace sandbox", () => {
  const workspace = createTempWorkspace("aa-div-sec-");
  const outside = createTempWorkspace("aa-div-outside-");

  try {
    seedDivision(join(outside, "divisions"));
    const loader = new DivisionLoader({
      divisionsRoot: join(outside, "divisions"),
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(() => loader.loadAll(), /sandbox\.path_outside_allowed_roots/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("division loader blocks symlink prompt escapes inside the division tree", () => {
  const workspace = createTempWorkspace("aa-div-sec-");
  const outside = createTempWorkspace("aa-div-target-");

  try {
    const divisionsRoot = join(workspace, "divisions");
    seedDivision(divisionsRoot);
    createFile(join(outside, "prompt.md"), "# escaped\n");
    rmSync(join(divisionsRoot, "general-ops/roles/general_executor.prompt.md"));
    createSymlink(
      join(outside, "prompt.md"),
      join(divisionsRoot, "general-ops/roles/general_executor.prompt.md"),
    );

    const loader = new DivisionLoader({
      divisionsRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(() => loader.loadAll(), /sandbox\.symlink_denied/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("division loader blocks output schema escapes outside the division root", () => {
  const workspace = createTempWorkspace("aa-div-sec-");

  try {
    const divisionsRoot = join(workspace, "divisions");
    seedDivision(divisionsRoot);
    createFile(join(divisionsRoot, "outside/minimal-output.json"), JSON.stringify({
      type: "object",
      required: ["summary", "result"],
      properties: {
        summary: { type: "string", minLength: 1 },
        result: { type: "string", minLength: 1 },
      },
    }));
    createFile(
      join(divisionsRoot, "general-ops/workflows/minimal.yaml"),
      [
        "id: single_agent_minimal",
        "division_id: general-ops",
        "steps:",
        "  - step_id: analyze_request",
        "    role_id: general_executor",
        "    output_key: analysis",
        "    output_schema: ../outside/minimal-output.json",
        "    timeout_ms: 120000",
        "    max_attempts: 1",
      ].join("\n"),
    );

    const loader = new DivisionLoader({
      divisionsRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(() => loader.loadAll(), /sandbox\.path_outside_allowed_roots/);
  } finally {
    cleanupPath(workspace);
  }
});
