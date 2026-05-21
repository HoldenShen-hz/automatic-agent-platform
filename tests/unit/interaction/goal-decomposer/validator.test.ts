import { describe, it } from "node:test";
import assert from "node:assert";
import { validateGoalDecomposition } from "../../../../../src/interaction/goal-decomposer/validator/index.js";
import type { GoalDecomposition } from "../../../../../src/interaction/goal-decomposer/index.js";

function createMockGoalDecomposition(overrides: Partial<GoalDecomposition> = {}): GoalDecomposition {
  return {
    goalId: "test-goal",
    tasks: [],
    dependencyGraph: [],
    estimatedDuration: "2d",
    estimatedCost: {
      estimatedCostUsd: 0.5,
      confidence: "medium",
      sampleCount: 3,
      divisionId: null,
      basedOn: "default",
    },
    riskSummary: {
      overallRisk: "medium",
      riskFactors: [],
      reversible: true,
      sideEffects: [],
      approvalNeeded: false,
    },
    decompositionConfidence: 0.75,
    requiresHumanReview: false,
    depthUsed: 1,
    maxDepthReached: false,
    lifecycleState: "decomposed",
    goalGraphDraft: {
      goalId: "test-goal",
      lifecycleState: "decomposed",
      constraintEnvelope: {
        budgetLimitUsd: null,
        riskTolerance: "medium",
        requiresApproval: false,
        requiredPermissions: [],
        requiredCapabilities: [],
      },
      plannerIntent: "template",
      evidenceRefs: [],
    },
    taskGraphDraft: {
      graphId: "test-goal:task_graph_draft",
      goalId: "test-goal",
      tasks: [],
      dependencyGraph: [],
      normalized: true,
      validationMessages: [],
      worstPathTaskIds: [],
    },
    plannerHandoff: {
      handoffId: "test-goal:planner_handoff",
      goalId: "test-goal",
      state: "ready_for_planner",
      graphId: "test-goal:task_graph_draft",
      constraintEnvelope: {
        budgetLimitUsd: null,
        riskTolerance: "medium",
        requiresApproval: false,
        requiredPermissions: [],
        requiredCapabilities: [],
      },
    },
    harnessRouting: {
      harnessRun: {
        harnessRunId: "test-goal:harness_run",
        domainId: "project-management",
      },
      planGraphBundle: {
        planGraphBundleId: "test-goal:plan_graph_bundle",
        validationReport: { valid: true },
        graph: { nodes: [], edges: [] },
      },
      initialStep: {
        nodeRun: {
          harnessRunId: "test-goal:harness_run",
          nodeId: "test-goal:initial_step",
        },
        receipt: { status: "succeeded" },
      },
    },
    ...overrides,
  };
}

describe("goal-decomposer/validator", () => {
  describe("validateGoalDecomposition", () => {
    it("returns empty findings for valid decomposition", () => {
      const decomposition = createMockGoalDecomposition({
        tasks: [
          {
            taskId: "task:1",
            domainId: "general_ops",
            description: "Task 1",
            inputs: {},
            expectedOutputs: ["output1"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.1,
              confidence: "medium",
              sampleCount: 1,
              divisionId: null,
              basedOn: "default",
            },
          },
          {
            taskId: "task:2",
            domainId: "general_ops",
            description: "Task 2",
            inputs: {},
            expectedOutputs: ["output2"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.1,
              confidence: "medium",
              sampleCount: 1,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: ["task:1"],
          },
        ],
        dependencyGraph: [
          { fromTask: "task:1", toTask: "task:2", type: "blocks" },
        ],
      });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.length === 0, `Expected no findings but got: ${JSON.stringify(findings)}`);
    });

    it("returns finding for empty tasks", () => {
      const decomposition = createMockGoalDecomposition({ tasks: [] });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.includes("goal_decomposition.empty_tasks"), `Expected empty_tasks finding but got: ${JSON.stringify(findings)}`);
    });

    it("returns finding for invalid confidence below range", () => {
      const decomposition = createMockGoalDecomposition({ decompositionConfidence: -0.1 });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.includes("goal_decomposition.invalid_confidence"), `Expected invalid_confidence finding but got: ${JSON.stringify(findings)}`);
    });

    it("returns finding for invalid confidence above range", () => {
      const decomposition = createMockGoalDecomposition({ decompositionConfidence: 1.5 });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.includes("goal_decomposition.invalid_confidence"), `Expected invalid_confidence finding but got: ${JSON.stringify(findings)}`);
    });

    it("returns finding for self-dependency in dependsOn", () => {
      const decomposition = createMockGoalDecomposition({
        tasks: [
          {
            taskId: "task:1",
            domainId: "general_ops",
            description: "Self-referencing task",
            inputs: {},
            expectedOutputs: ["output1"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.1,
              confidence: "medium",
              sampleCount: 1,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: ["task:1"], // self-dependency
          },
        ],
      });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(
        findings.some((f) => f.includes("self_dependency")),
        `Expected self_dependency finding but got: ${JSON.stringify(findings)}`,
      );
    });

    it("returns finding for non-existent task in dependsOn", () => {
      const decomposition = createMockGoalDecomposition({
        tasks: [
          {
            taskId: "task:1",
            domainId: "general_ops",
            description: "Task with invalid dependsOn",
            inputs: {},
            expectedOutputs: ["output1"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.1,
              confidence: "medium",
              sampleCount: 1,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: ["non-existent-task"],
          },
        ],
      });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(
        findings.some((f) => f.includes("invalid_depends_on")),
        `Expected invalid_depends_on finding but got: ${JSON.stringify(findings)}`,
      );
    });

    it("returns finding when cycle is detected in dependency graph", () => {
      const decomposition = createMockGoalDecomposition({
        tasks: [
          {
            taskId: "task:1",
            domainId: "general_ops",
            description: "Task 1",
            inputs: {},
            expectedOutputs: ["output1"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.1, confidence: "medium", sampleCount: 1, divisionId: null, basedOn: "default" },
          },
          {
            taskId: "task:2",
            domainId: "general_ops",
            description: "Task 2",
            inputs: {},
            expectedOutputs: ["output2"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.1, confidence: "medium", sampleCount: 1, divisionId: null, basedOn: "default" },
          },
        ],
        dependencyGraph: [
          { fromTask: "task:1", toTask: "task:2", type: "blocks" },
          { fromTask: "task:2", toTask: "task:1", type: "blocks" }, // creates cycle
        ],
      });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.includes("goal_decomposition.cycle_detected"), `Expected cycle_detected finding but got: ${JSON.stringify(findings)}`);
    });

    it("returns finding when maxDepthReached is true", () => {
      const decomposition = createMockGoalDecomposition({ maxDepthReached: true });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.includes("goal_decomposition.max_depth_reached"), `Expected max_depth_reached finding but got: ${JSON.stringify(findings)}`);
    });

    it("returns multiple findings when multiple issues exist", () => {
      const decomposition = createMockGoalDecomposition({
        tasks: [],
        decompositionConfidence: 1.5,
        maxDepthReached: true,
      });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.includes("goal_decomposition.empty_tasks"), "Should have empty_tasks");
      assert.ok(findings.includes("goal_decomposition.invalid_confidence"), "Should have invalid_confidence");
      assert.ok(findings.includes("goal_decomposition.max_depth_reached"), "Should have max_depth_reached");
    });

    it("returns no findings for valid complex graph without cycles", () => {
      const decomposition = createMockGoalDecomposition({
        tasks: [
          {
            taskId: "task:start",
            domainId: "general_ops",
            description: "Start task",
            inputs: {},
            expectedOutputs: ["output"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.05, confidence: "medium", sampleCount: 1, divisionId: null, basedOn: "default" },
          },
          {
            taskId: "task:A",
            domainId: "general_ops",
            description: "Task A",
            inputs: {},
            expectedOutputs: ["output"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: { estimatedCostUsd: 0.1, confidence: "medium", sampleCount: 1, divisionId: null, basedOn: "default" },
            dependsOn: ["task:start"],
          },
          {
            taskId: "task:B",
            domainId: "general_ops",
            description: "Task B",
            inputs: {},
            expectedOutputs: ["output"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: { estimatedCostUsd: 0.1, confidence: "medium", sampleCount: 1, divisionId: null, basedOn: "default" },
            dependsOn: ["task:start"],
          },
          {
            taskId: "task:end",
            domainId: "general_ops",
            description: "End task",
            inputs: {},
            expectedOutputs: ["output"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.05, confidence: "medium", sampleCount: 1, divisionId: null, basedOn: "default" },
            dependsOn: ["task:A", "task:B"],
          },
        ],
        dependencyGraph: [
          { fromTask: "task:start", toTask: "task:A", type: "blocks" },
          { fromTask: "task:start", toTask: "task:B", type: "blocks" },
          { fromTask: "task:A", toTask: "task:end", type: "blocks" },
          { fromTask: "task:B", toTask: "task:end", type: "blocks" },
        ],
      });
      const findings = validateGoalDecomposition(decomposition);
      assert.ok(findings.length === 0, `Expected no findings but got: ${JSON.stringify(findings)}`);
    });
  });
});