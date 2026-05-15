import assert from "node:assert/strict";
import test from "node:test";

import {
  SubWorkflowExecutor,
  type SubWorkflowContext,
  type SubWorkflowDefinition,
} from "../../../../../src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.js";

const context: SubWorkflowContext = {
  harnessRunId: "harness-run-001",
  parentNodeRunId: null,
  taskId: "task-001",
  tenantId: "tenant-001",
  correlationId: "corr-001",
  sandboxTier: "workspace_write",
};

const definition: SubWorkflowDefinition = {
  workflowId: "wf-canonical",
  name: "Canonical Workflow",
  rollbackPolicy: "none",
  steps: [
    {
      nodeId: "node-build",
      stepId: "legacy-build",
      name: "Build",
      action: "build",
      maxRetries: 1,
    },
  ],
};

test("SubWorkflowExecutor uses subWorkflowRunId as primary run identifier while preserving executionId alias", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const subWorkflowRunId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(subWorkflowRunId);

  assert.equal(result.subWorkflowRunId, subWorkflowRunId);
  assert.equal(result.executionId, subWorkflowRunId);
  assert.equal(result.harnessRunId, "harness-run-001");
  assert.equal(result.steps[0]?.nodeId, "node-build");
  assert.equal(result.steps[0]?.stepId, "legacy-build");
});
