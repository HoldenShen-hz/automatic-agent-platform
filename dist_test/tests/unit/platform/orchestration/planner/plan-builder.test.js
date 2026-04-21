import test from "node:test";
import assert from "node:assert/strict";
import { PlanBuilder } from "../../../../../src/platform/orchestration/planner/plan-builder.js";
const workflow = {
    workflow: {
        workflowId: "wf_build",
        divisionId: "coding",
        steps: [],
    },
    executionSteps: [
        {
            stepId: "step_plan",
            divisionId: "coding",
            roleId: "planner",
            inputKeys: [],
            agentId: "agent_planner",
            outputKey: "plan",
            outputSchemaPath: null,
            dependsOnStepIds: [],
            dependencyTypes: {},
            timeoutMs: 1000,
            maxAttempts: 1,
        },
        {
            stepId: "step_execute",
            divisionId: "coding",
            roleId: "builder",
            inputKeys: ["plan"],
            agentId: "agent_builder",
            outputKey: "patch",
            outputSchemaPath: null,
            dependsOnStepIds: ["step_plan"],
            dependencyTypes: { step_plan: "hard" },
            timeoutMs: 1000,
            maxAttempts: 2,
        },
    ],
    planReason: "workflow.requires_multi_step_orchestration",
    dependencyEdges: [{ fromStepId: "step_plan", toStepId: "step_execute" }],
};
test("PlanBuilder builds reflexive multi-step plan from assessment", () => {
    const builder = new PlanBuilder();
    const plan = builder.build({
        observation: {
            taskId: "task_1",
            timestamp: Date.now(),
            objective: "build feature",
            currentPhase: "planning",
            userIntent: {
                raw: "build feature",
                normalized: "build feature",
                confidence: 0.9,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 2,
                relevantFiles: [{ path: "src/app.ts" }],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read", "apply_patch"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: ["src/app.ts"],
            metrics: {},
        },
        assessment: {
            taskId: "task_1",
            timestamp: Date.now(),
            situationRef: "task_situation:task_1:1",
            phase: "pre-execution",
            complexity: "complex",
            risk: "medium",
            riskAssessment: {
                level: "medium",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "multi-step",
                rationale: "needs orchestration",
            },
            resourceAllocation: {
                modelClass: "medium",
                maxTokens: 5000,
                timeoutMs: 60000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow,
    });
    assert.equal(plan.strategy, "reflexive");
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.steps[1]?.dependencies[0], "step_plan");
});
test("PlanBuilder assigns correct step order for dependencies", () => {
    const builder = new PlanBuilder();
    const plan = builder.build({
        observation: {
            taskId: "task_2",
            timestamp: Date.now(),
            objective: "multi-step task",
            currentPhase: "planning",
            userIntent: {
                raw: "multi-step task",
                normalized: "multi-step task",
                confidence: 0.85,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read", "write"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_2",
            timestamp: Date.now(),
            situationRef: "task_situation:task_2:1",
            phase: "pre-execution",
            complexity: "moderate",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "multi-step",
                rationale: "moderate complexity",
            },
            resourceAllocation: {
                modelClass: "small",
                maxTokens: 3000,
                timeoutMs: 30000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow,
    });
    assert.equal(plan.steps[0]?.stepId, "step_plan");
    assert.equal(plan.steps[1]?.stepId, "step_execute");
});
test("PlanBuilder uses linear strategy for simple plans", () => {
    const builder = new PlanBuilder();
    const singleStepWorkflow = {
        workflow: {
            workflowId: "wf_simple",
            divisionId: "coding",
            steps: [],
        },
        executionSteps: [
            {
                stepId: "step_1",
                divisionId: "coding",
                roleId: "builder",
                inputKeys: [],
                agentId: "agent_builder",
                outputKey: "result",
                outputSchemaPath: null,
                dependsOnStepIds: [],
                dependencyTypes: {},
                timeoutMs: 1000,
                maxAttempts: 1,
            },
        ],
        planReason: "workflow.single_step",
        dependencyEdges: [],
    };
    const plan = builder.build({
        observation: {
            taskId: "task_3",
            timestamp: Date.now(),
            objective: "simple task",
            currentPhase: "planning",
            userIntent: {
                raw: "simple task",
                normalized: "simple task",
                confidence: 0.95,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_3",
            timestamp: Date.now(),
            situationRef: "task_situation:task_3:1",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "single",
                rationale: "simple task",
            },
            resourceAllocation: {
                modelClass: "small",
                maxTokens: 1000,
                timeoutMs: 10000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: singleStepWorkflow,
    });
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0]?.stepId, "step_1");
});
test("PlanBuilder.replan creates new version with incremented version and parentVersion", () => {
    const builder = new PlanBuilder();
    const initialPlan = builder.build({
        observation: {
            taskId: "task_replan",
            timestamp: Date.now(),
            objective: "initial task",
            currentPhase: "planning",
            userIntent: {
                raw: "initial task",
                normalized: "initial task",
                confidence: 0.9,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_replan",
            timestamp: Date.now(),
            situationRef: "task_situation:task_replan:1",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "single",
                rationale: "simple",
            },
            resourceAllocation: {
                modelClass: "small",
                maxTokens: 1000,
                timeoutMs: 10000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: {
            workflow: {
                workflowId: "wf_replan",
                divisionId: "coding",
                steps: [],
            },
            executionSteps: [
                {
                    stepId: "step_1",
                    divisionId: "coding",
                    roleId: "builder",
                    inputKeys: [],
                    agentId: "agent_builder",
                    outputKey: "result",
                    outputSchemaPath: null,
                    dependsOnStepIds: [],
                    dependencyTypes: {},
                    timeoutMs: 1000,
                    maxAttempts: 1,
                },
            ],
            planReason: "workflow.single_step",
            dependencyEdges: [],
        },
    });
    assert.equal(initialPlan.version, 1);
    assert.equal(initialPlan.parentVersion, undefined);
    assert.equal(initialPlan.strategy, "linear");
    const replanned = builder.replan(initialPlan, {
        observation: {
            taskId: "task_replan",
            timestamp: Date.now(),
            objective: "replanned task",
            currentPhase: "planning",
            userIntent: {
                raw: "replanned task",
                normalized: "replanned task",
                confidence: 0.85,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: ["task_replan"],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_replan",
            timestamp: Date.now(),
            situationRef: "task_situation:task_replan:2",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "single",
                rationale: "replan",
            },
            resourceAllocation: {
                modelClass: "small",
                maxTokens: 1000,
                timeoutMs: 10000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: {
            workflow: {
                workflowId: "wf_replan",
                divisionId: "coding",
                steps: [],
            },
            executionSteps: [
                {
                    stepId: "step_1",
                    divisionId: "coding",
                    roleId: "builder",
                    inputKeys: [],
                    agentId: "agent_builder",
                    outputKey: "result",
                    outputSchemaPath: null,
                    dependsOnStepIds: [],
                    dependencyTypes: {},
                    timeoutMs: 1000,
                    maxAttempts: 1,
                },
            ],
            planReason: "workflow.single_step",
            dependencyEdges: [],
        },
    });
    assert.equal(replanned.version, 2);
    assert.equal(replanned.parentVersion, 1);
    assert.equal(replanned.strategy, "replanned");
});
test("PlanBuilder.replan uses replanned strategy for subsequent versions", () => {
    const builder = new PlanBuilder();
    const v1Plan = builder.build({
        observation: {
            taskId: "task_v1",
            timestamp: Date.now(),
            objective: "v1 task",
            currentPhase: "planning",
            userIntent: {
                raw: "v1 task",
                normalized: "v1 task",
                confidence: 0.9,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_v1",
            timestamp: Date.now(),
            situationRef: "task_situation:task_v1:1",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "single",
                rationale: "simple",
            },
            resourceAllocation: {
                modelClass: "small",
                maxTokens: 1000,
                timeoutMs: 10000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: {
            workflow: {
                workflowId: "wf_v1",
                divisionId: "coding",
                steps: [],
            },
            executionSteps: [
                {
                    stepId: "step_1",
                    divisionId: "coding",
                    roleId: "builder",
                    inputKeys: [],
                    agentId: "agent_builder",
                    outputKey: "result",
                    outputSchemaPath: null,
                    dependsOnStepIds: [],
                    dependencyTypes: {},
                    timeoutMs: 1000,
                    maxAttempts: 1,
                },
            ],
            planReason: "workflow.single_step",
            dependencyEdges: [],
        },
    });
    const v2Plan = builder.replan(v1Plan, {
        observation: {
            taskId: "task_v1",
            timestamp: Date.now(),
            objective: "v2 task",
            currentPhase: "planning",
            userIntent: {
                raw: "v2 task",
                normalized: "v2 task",
                confidence: 0.8,
            },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: ["task_v1"],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_v1",
            timestamp: Date.now(),
            situationRef: "task_situation:task_v1:2",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "coding",
                workflow: "single",
                rationale: "replan",
            },
            resourceAllocation: {
                modelClass: "small",
                maxTokens: 1000,
                timeoutMs: 10000,
            },
            approvalPolicy: {
                required: false,
                level: "none",
            },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: {
            workflow: {
                workflowId: "wf_v1",
                divisionId: "coding",
                steps: [],
            },
            executionSteps: [
                {
                    stepId: "step_1",
                    divisionId: "coding",
                    roleId: "builder",
                    inputKeys: [],
                    agentId: "agent_builder",
                    outputKey: "result",
                    outputSchemaPath: null,
                    dependsOnStepIds: [],
                    dependencyTypes: {},
                    timeoutMs: 1000,
                    maxAttempts: 1,
                },
            ],
            planReason: "workflow.single_step",
            dependencyEdges: [],
        },
    });
    assert.equal(v1Plan.version, 1);
    assert.equal(v2Plan.version, 2);
    assert.equal(v2Plan.parentVersion, 1);
    assert.equal(v2Plan.strategy, "replanned");
});
test("PlanBuilder uses default timeout when timeoutMs is undefined", () => {
    const builder = new PlanBuilder();
    const workflowWithMissingTimeout = {
        workflow: { workflowId: "wf_test", divisionId: "coding", steps: [] },
        executionSteps: [
            {
                stepId: "step_1",
                divisionId: "coding",
                roleId: "builder",
                inputKeys: [],
                agentId: "agent_builder",
                outputKey: "result",
                outputSchemaPath: null,
                dependsOnStepIds: [],
                dependencyTypes: {},
                // timeoutMs is missing
                maxAttempts: 1,
            },
        ],
        planReason: "test",
        dependencyEdges: [],
    };
    const plan = builder.build({
        observation: {
            taskId: "task_timeout",
            timestamp: Date.now(),
            objective: "test timeout",
            currentPhase: "planning",
            userIntent: { raw: "test", normalized: "test", confidence: 0.9 },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_timeout",
            timestamp: Date.now(),
            situationRef: "task_situation:task_timeout:1",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: { level: "low", factors: [] },
            routingDecision: { division: "coding", workflow: "single", rationale: "test" },
            resourceAllocation: { modelClass: "small", maxTokens: 5000, timeoutMs: 60000 },
            approvalPolicy: { required: false, level: "none" },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: workflowWithMissingTimeout,
    });
    // Should use default timeout of 60000
    assert.equal(plan.steps[0].timeout, 60000);
});
test("PlanBuilder uses default maxAttempts when maxAttempts is undefined", () => {
    const builder = new PlanBuilder();
    const workflowWithMissingMaxAttempts = {
        workflow: { workflowId: "wf_test", divisionId: "coding", steps: [] },
        executionSteps: [
            {
                stepId: "step_1",
                divisionId: "coding",
                roleId: "builder",
                inputKeys: [],
                agentId: "agent_builder",
                outputKey: "result",
                outputSchemaPath: null,
                dependsOnStepIds: [],
                dependencyTypes: {},
                timeoutMs: 5000,
                // maxAttempts is missing - should default to 1, then maxRetries = (1) - 1 = 0
            },
        ],
        planReason: "test",
        dependencyEdges: [],
    };
    const plan = builder.build({
        observation: {
            taskId: "task_maxattempts",
            timestamp: Date.now(),
            objective: "test max attempts",
            currentPhase: "planning",
            userIntent: { raw: "test", normalized: "test", confidence: 0.9 },
            blockers: [],
            codebaseSnapshot: {
                rootPath: process.cwd(),
                fileCount: 1,
                relevantFiles: [],
            },
            environmentContext: {
                nodeVersion: process.version,
                platform: process.platform,
                workingDirectory: process.cwd(),
                availableTools: ["read"],
            },
            historicalContext: {
                previousTaskIds: [],
                relatedMemoryRefs: [],
            },
            relevantMemory: [],
            fileRefs: [],
            metrics: {},
        },
        assessment: {
            taskId: "task_maxattempts",
            timestamp: Date.now(),
            situationRef: "task_situation:task_maxattempts:1",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: { level: "low", factors: [] },
            routingDecision: { division: "coding", workflow: "single", rationale: "test" },
            resourceAllocation: { modelClass: "small", maxTokens: 5000, timeoutMs: 60000 },
            approvalPolicy: { required: false, level: "none" },
            executionMode: "auto",
            suggestedActions: [],
        },
        workflow: workflowWithMissingMaxAttempts,
    });
    // maxAttempts defaults to 1, so maxRetries = max(0, 1-1) = 0
    assert.equal(plan.steps[0].retryPolicy.maxRetries, 0);
});
//# sourceMappingURL=plan-builder.test.js.map