import assert from "node:assert/strict";
import test from "node:test";

import { PlanBuilder } from "../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { PlanStrategySelector } from "../../../src/platform/five-plane-orchestration/planner/plan-strategy-selector.js";

test("integration: PlanStrategySelector escalates multi-division critical workflows to reflexive strategy", () => {
  const selector = new PlanStrategySelector();

  const strategy = selector.select({
    observation: {
      objective: "Repair the cross-division deployment pipeline",
      environmentContext: {
        availableTools: ["read", "apply_patch"],
      },
    } as never,
    assessment: {
      complexity: "complex",
      risk: "critical",
      resourceAllocation: {
        maxTokens: 12000,
        timeoutMs: 60000,
      },
    } as never,
    workflow: {
      executionSteps: [
        { stepId: "step-1", divisionId: "engineering" },
        { stepId: "step-2", divisionId: "operations" },
      ],
    } as never,
  });

  assert.equal(strategy, "reflexive");
});

test("integration: PlanBuilder rejects cyclic execution graphs instead of silently materializing a plan", () => {
  const builder = new PlanBuilder();

  assert.throws(() => {
    builder.build({
      observation: {
        objective: "Coordinate a cyclic rollout plan",
      } as never,
      assessment: {
        complexity: "complex",
        risk: "medium",
      resourceAllocation: {
          maxTokens: 6000,
          timeoutMs: 45000,
        },
      } as never,
      workflow: {
        executionSteps: [
          {
            stepId: "step-1",
            divisionId: "engineering",
            roleId: "owner",
            dependsOnStepIds: ["step-2"],
            inputKeys: [],
            maxAttempts: 1,
            timeoutMs: 1000,
            outputKey: "prepared",
          },
          {
            stepId: "step-2",
            divisionId: "operations",
            roleId: "operator",
            dependsOnStepIds: ["step-1"],
            inputKeys: [],
            maxAttempts: 1,
            timeoutMs: 1000,
            outputKey: "deployed",
          },
        ],
      } as never,
    });
  }, /INVALID_DAG|DAG validation failed/);
});

test("integration: PlanBuilder produces a normalized execution order for a valid DAG", () => {
  const builder = new PlanBuilder();

  const bundle = builder.build({
    observation: {
      objective: "Prepare, validate, and deploy release assets",
    } as never,
    assessment: {
      complexity: "moderate",
      risk: "medium",
      resourceAllocation: {
        maxTokens: 6000,
        timeoutMs: 45000,
      },
    } as never,
    workflow: {
      executionSteps: [
        {
          stepId: "step-1",
          divisionId: "engineering",
          roleId: "owner",
          dependsOnStepIds: [],
          inputKeys: [],
          maxAttempts: 1,
          timeoutMs: 1000,
          outputKey: "prepared",
        },
        {
          stepId: "step-2",
          divisionId: "engineering",
          roleId: "reviewer",
          dependsOnStepIds: ["step-1"],
          inputKeys: ["prepared"],
          maxAttempts: 1,
          timeoutMs: 1000,
          outputKey: "validated",
        },
        {
          stepId: "step-3",
          divisionId: "operations",
          roleId: "operator",
          dependsOnStepIds: ["step-2"],
          inputKeys: ["validated"],
          maxAttempts: 1,
          timeoutMs: 1000,
          outputKey: "deployed",
        },
      ],
    } as never,
  });

  assert.deepEqual(bundle.graph.entryNodeIds, ["step-1"]);
  assert.deepEqual(bundle.graph.terminalNodeIds, ["step-3"]);
  assert.equal(bundle.graph.nodes.length, 3);
  assert.equal(bundle.validationReport.valid, true);
});
