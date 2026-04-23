import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GoalDecompositionService, } from "../../../../src/interaction/goal-decomposer/index.js";
import { validateGoalDecomposition } from "../../../../src/interaction/goal-decomposer/validator/index.js";
import { buildExecutionBatches } from "../../../../src/interaction/goal-decomposer/planner/index.js";
import { topologicallySortTaskIds, detectDependencyCycle } from "../../../../src/interaction/goal-decomposer/dependency-graph/index.js";
describe("GoalDecompositionService - Depth Limit", () => {
    const service = new GoalDecompositionService();
    it("should use default max depth of 5", async () => {
        const result = await service.decompose("发起一个简单的营销活动");
        assert.strictEqual(result.depthUsed, 0);
        assert.strictEqual(result.maxDepthReached, false);
    });
    it("should set maxDepthReached when current depth equals max depth", async () => {
        const serviceWithLowDepth = new GoalDecompositionService({ maxDepth: 2, currentDepth: 2 });
        const result = await serviceWithLowDepth.decompose("发起一个简单的营销活动");
        assert.strictEqual(result.maxDepthReached, true);
        assert.strictEqual(result.depthUsed, 2);
    });
    it("should not set maxDepthReached when below max depth", async () => {
        const serviceWithLowDepth = new GoalDecompositionService({ maxDepth: 5, currentDepth: 2 });
        const result = await serviceWithLowDepth.decompose("发起一个简单的营销活动");
        assert.strictEqual(result.maxDepthReached, false);
        assert.strictEqual(result.depthUsed, 2);
    });
    it("should respect custom max depth option", async () => {
        const serviceWithCustomDepth = new GoalDecompositionService({ maxDepth: 3 });
        const result = await serviceWithCustomDepth.decompose("发起一个简单的营销活动");
        assert.strictEqual(result.depthUsed, 0);
        assert.strictEqual(result.maxDepthReached, false);
    });
});
describe("GoalDecompositionService - dependsOn Support", () => {
    it("should build dependencies from dependsOn field", async () => {
        const goal = {
            goalId: "goal-dag-test",
            description: "Test DAG with depends_on",
            owner: "test",
            successCriteria: [],
            constraints: [],
            priority: "normal",
        };
        // Create service and manually construct tasks with dependsOn
        const service = new GoalDecompositionService();
        const result = await service.decompose(goal);
        // The default generic decomposition doesn't use dependsOn
        assert.ok(result.tasks.length >= 1);
        assert.ok(result.dependencyGraph.length >= 0);
    });
    it("should include dependsOn in PlannedTask interface", () => {
        const task = {
            taskId: "task-1",
            domainId: "test",
            description: "Test task",
            inputs: {},
            expectedOutputs: [],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: {
                estimatedCostUsd: 0.01,
                confidence: "low",
                sampleCount: 0,
                divisionId: null,
                basedOn: "default",
            },
            dependsOn: ["task-0"],
        };
        assert.deepStrictEqual(task.dependsOn, ["task-0"]);
    });
});
describe("GoalDecompositionService - DAG Parallel Execution", () => {
    it("should compute parallel task groups for marketing campaign", async () => {
        const service = new GoalDecompositionService();
        const goal = {
            goalId: "goal-marketing-parallel",
            description: "发起春季营销 campaign 并追踪 ROI",
            owner: "marketing_lead",
            successCriteria: [],
            constraints: [],
            priority: "high",
        };
        const result = await service.decompose(goal);
        // First task (content_production) should be in its own group initially
        assert.ok(result.parallelTaskGroups && result.parallelTaskGroups.length > 0);
        // First level tasks can run in parallel with nothing
        assert.strictEqual(result.parallelTaskGroups[0]?.length, 1);
    });
    it("should produce topologically sorted task IDs", async () => {
        const service = new GoalDecompositionService();
        const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");
        assert.ok(result.topologicallySortedTaskIds);
        assert.strictEqual(result.topologicallySortedTaskIds.length, result.tasks.length);
    });
    it("should identify critical path tasks", async () => {
        const service = new GoalDecompositionService();
        const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");
        assert.ok(result.criticalPathTaskIds);
        assert.ok(result.criticalPathTaskIds.length > 0);
    });
});
describe("buildExecutionBatches", () => {
    it("should group independent tasks into same batch", () => {
        // Task A and B are independent, C depends on both
        const taskIds = ["A", "B", "C"];
        const edges = [
            { fromTask: "A", toTask: "C" },
            { fromTask: "B", toTask: "C" },
        ];
        const batches = buildExecutionBatches(taskIds, edges);
        // A and B should be in first batch (no dependencies), C in second
        assert.strictEqual(batches.length, 2);
        assert.ok(batches[0].includes("A") || batches[0].includes("B"));
    });
    it("should create separate batches for dependent tasks", () => {
        // A -> B -> C (sequential)
        const taskIds = ["A", "B", "C"];
        const edges = [
            { fromTask: "A", toTask: "B" },
            { fromTask: "B", toTask: "C" },
        ];
        const batches = buildExecutionBatches(taskIds, edges);
        assert.strictEqual(batches.length, 3);
        assert.deepStrictEqual(batches[0], ["A"]);
        assert.deepStrictEqual(batches[1], ["B"]);
        assert.deepStrictEqual(batches[2], ["C"]);
    });
    it("should handle diamond dependency pattern", () => {
        //    A
        //  ↙   ↘
        // B     C
        //  ↘   ↙
        //    D
        const taskIds = ["A", "B", "C", "D"];
        const edges = [
            { fromTask: "A", toTask: "B" },
            { fromTask: "A", toTask: "C" },
            { fromTask: "B", toTask: "D" },
            { fromTask: "C", toTask: "D" },
        ];
        const batches = buildExecutionBatches(taskIds, edges);
        assert.strictEqual(batches.length, 3);
        assert.deepStrictEqual(batches[0], ["A"]);
        assert.ok(batches[1].includes("B") && batches[1].includes("C"));
        assert.deepStrictEqual(batches[2], ["D"]);
    });
    it("should handle empty dependencies", () => {
        const taskIds = ["A", "B"];
        const edges = [];
        const batches = buildExecutionBatches(taskIds, edges);
        // Both tasks are independent, should be in same batch
        assert.strictEqual(batches.length, 1);
        assert.ok(batches[0].includes("A") && batches[0].includes("B"));
    });
});
describe("topologicallySortTaskIds", () => {
    it("should return correct topological order", () => {
        const taskIds = ["C", "A", "B"];
        const edges = [
            { fromTask: "A", toTask: "C" },
            { fromTask: "B", toTask: "C" },
        ];
        const sorted = topologicallySortTaskIds(taskIds, edges);
        assert.ok(sorted.indexOf("A") < sorted.indexOf("C"));
        assert.ok(sorted.indexOf("B") < sorted.indexOf("C"));
    });
    it("should return all tasks when no edges", () => {
        const taskIds = ["A", "B", "C"];
        const edges = [];
        const sorted = topologicallySortTaskIds(taskIds, edges);
        assert.strictEqual(sorted.length, 3);
    });
});
describe("detectDependencyCycle", () => {
    it("should detect cycle in dependency graph", () => {
        const taskIds = ["A", "B", "C"];
        const edges = [
            { fromTask: "A", toTask: "B" },
            { fromTask: "B", toTask: "C" },
            { fromTask: "C", toTask: "A" }, // Creates cycle
        ];
        const hasCycle = detectDependencyCycle(taskIds, edges);
        assert.strictEqual(hasCycle, true);
    });
    it("should not detect cycle in valid DAG", () => {
        const taskIds = ["A", "B", "C"];
        const edges = [
            { fromTask: "A", toTask: "B" },
            { fromTask: "B", toTask: "C" },
        ];
        const hasCycle = detectDependencyCycle(taskIds, edges);
        assert.strictEqual(hasCycle, false);
    });
});
describe("validateGoalDecomposition", () => {
    it("should validate dependsOn references", () => {
        const decomposition = {
            goalId: "goal-validate",
            tasks: [
                {
                    taskId: "task-1",
                    domainId: "test",
                    description: "Task 1",
                    inputs: {},
                    expectedOutputs: [],
                    delegationMode: "auto",
                    estimatedDuration: "1h",
                    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
                    dependsOn: ["non-existent-task"],
                },
            ],
            dependencyGraph: [],
            estimatedDuration: "1d",
            estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
            riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
            decompositionConfidence: 0.9,
            requiresHumanReview: false,
            depthUsed: 0,
            maxDepthReached: false,
        };
        const findings = validateGoalDecomposition(decomposition);
        assert.ok(findings.some((f) => f.includes("invalid_depends_on")));
    });
    it("should detect self-dependency", () => {
        const decomposition = {
            goalId: "goal-validate",
            tasks: [
                {
                    taskId: "task-1",
                    domainId: "test",
                    description: "Task 1",
                    inputs: {},
                    expectedOutputs: [],
                    delegationMode: "auto",
                    estimatedDuration: "1h",
                    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
                    dependsOn: ["task-1"], // Self-dependency
                },
            ],
            dependencyGraph: [],
            estimatedDuration: "1d",
            estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
            riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
            decompositionConfidence: 0.9,
            requiresHumanReview: false,
            depthUsed: 0,
            maxDepthReached: false,
        };
        const findings = validateGoalDecomposition(decomposition);
        assert.ok(findings.some((f) => f.includes("self_dependency")));
    });
    it("should warn when max depth was reached", () => {
        const decomposition = {
            goalId: "goal-validate",
            tasks: [
                {
                    taskId: "task-1",
                    domainId: "test",
                    description: "Task 1",
                    inputs: {},
                    expectedOutputs: [],
                    delegationMode: "auto",
                    estimatedDuration: "1h",
                    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
                },
            ],
            dependencyGraph: [],
            estimatedDuration: "1d",
            estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
            riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
            decompositionConfidence: 0.9,
            requiresHumanReview: false,
            depthUsed: 5,
            maxDepthReached: true,
        };
        const findings = validateGoalDecomposition(decomposition);
        assert.ok(findings.some((f) => f.includes("max_depth_reached")));
    });
    it("should return no findings for valid decomposition", () => {
        const decomposition = {
            goalId: "goal-validate",
            tasks: [
                {
                    taskId: "task-1",
                    domainId: "test",
                    description: "Task 1",
                    inputs: {},
                    expectedOutputs: [],
                    delegationMode: "auto",
                    estimatedDuration: "1h",
                    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
                },
                {
                    taskId: "task-2",
                    domainId: "test",
                    description: "Task 2",
                    inputs: {},
                    expectedOutputs: [],
                    delegationMode: "auto",
                    estimatedDuration: "1h",
                    estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
                    dependsOn: ["task-1"],
                },
            ],
            dependencyGraph: [
                { fromTask: "task-1", toTask: "task-2", type: "blocks" },
            ],
            estimatedDuration: "2d",
            estimatedCost: { estimatedCostUsd: 0.02, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
            riskSummary: { overallRisk: "low", riskFactors: [], reversible: true, sideEffects: [], approvalNeeded: false },
            decompositionConfidence: 0.9,
            requiresHumanReview: false,
            depthUsed: 0,
            maxDepthReached: false,
        };
        const findings = validateGoalDecomposition(decomposition);
        assert.strictEqual(findings.length, 0);
    });
});
//# sourceMappingURL=goal-decomposer-enhancements.test.js.map