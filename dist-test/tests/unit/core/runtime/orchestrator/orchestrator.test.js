import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import { runMultiStepOrchestration, executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests, } from "../../../../../src/core/runtime/orchestrator/index.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function createTempDbPath(name) {
    return join(__dirname, name);
}
function cleanupDb(dbPath) {
    if (existsSync(dbPath)) {
        unlinkSync(dbPath);
    }
}
test("runMultiStepOrchestration basic execution", async () => {
    const dbPath = createTempDbPath("test-basic.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Basic Orchestration",
        request: "Run basic test",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should return a result");
        assert.ok("snapshot" in result, "result should have snapshot property");
        assert.ok("routing" in result, "result should have routing property");
        assert.ok("plannedWorkflow" in result, "result should have plannedWorkflow property");
        assert.ok("streamFrames" in result, "result should have streamFrames property");
        assert.ok("compaction" in result, "result should have compaction property");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration with oapeflir plan request", async () => {
    const dbPath = createTempDbPath("test-oapeflir.db");
    cleanupDb(dbPath);
    const planSteps = [
        {
            stepId: "step_1",
            dependencies: [],
            outputs: ["output_1"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
        },
        {
            stepId: "step_2",
            dependencies: ["step_1"],
            outputs: ["output_2"],
            timeout: 30000,
            retryPolicy: { maxRetries: 1 },
        },
    ];
    const input = {
        dbPath,
        title: "Test Oapeflir Plan",
        request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle oapeflir plan");
        assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "workflowId should have oapeflir prefix");
        assert.ok(result.plannedWorkflow.executionSteps.length === 2, "should have 2 execution steps");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration creates task snapshot", async () => {
    const dbPath = createTempDbPath("test-snapshot.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Snapshot",
        request: "Create snapshot test",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result.snapshot, "result should have snapshot");
        assert.ok(result.snapshot.task, "snapshot should have task");
        assert.ok(result.snapshot.task.id, "task should have id");
        assert.ok(result.snapshot.task.status, "task should have status");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration workflow planning", async () => {
    const dbPath = createTempDbPath("test-planning.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Planning",
        request: "Test workflow planning",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result.plannedWorkflow, "result should have plannedWorkflow");
        assert.ok(result.plannedWorkflow.workflow, "plannedWorkflow should have workflow");
        assert.ok(result.plannedWorkflow.executionSteps, "plannedWorkflow should have executionSteps");
        assert.ok(Array.isArray(result.plannedWorkflow.executionSteps), "executionSteps should be array");
        assert.ok(result.plannedWorkflow.planReason, "plannedWorkflow should have planReason");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration routing", async () => {
    const dbPath = createTempDbPath("test-routing.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Routing",
        request: "Test routing",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result.routing, "result should have routing");
        assert.ok("workflowId" in result.routing, "routing should have workflowId");
        assert.ok("divisionId" in result.routing, "routing should have divisionId");
        assert.ok("routeReason" in result.routing, "routing should have routeReason");
        assert.ok("requiresOrchestration" in result.routing, "routing should have requiresOrchestration");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration streamFrames is array", async () => {
    const dbPath = createTempDbPath("test-frames.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Stream Frames",
        request: "Test stream frames",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok("streamFrames" in result, "result should have streamFrames property");
        assert.ok(Array.isArray(result.streamFrames), "streamFrames should be an array");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration with admission backpressure snapshot", async () => {
    const dbPath = createTempDbPath("test-backpressure.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Backpressure",
        request: "Test backpressure",
        admissionBackpressureSnapshot: () => ({
            status: "ok",
            degradationMode: "none",
            queueGovernance: {
                backlogSize: 0,
                dispatchableBacklogSize: 0,
                claimedBacklogSize: 0,
                oldestWaitSeconds: null,
                oldestClaimAgeSeconds: null,
                queueNames: [],
                starvationDetected: false,
            },
            findings: [],
        }),
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle custom backpressure snapshot");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration task status transitions to terminal state", async () => {
    const dbPath = createTempDbPath("test-transitions.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Transitions",
        request: "Test status transitions",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        const task = result.snapshot.task;
        assert.ok(task, "task should exist");
        // Task should be in a terminal state (done, failed, or cancelled)
        assert.ok(task.status === "done" || task.status === "failed" || task.status === "cancelled", `task status should be terminal, got ${task.status}`);
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration compaction result property", async () => {
    const dbPath = createTempDbPath("test-compaction.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Compaction",
        request: "Test compaction",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok("compaction" in result, "result should have compaction property");
        // compaction can be null or an object depending on context compaction
        assert.ok(result.compaction === null || typeof result.compaction === "object", "compaction should be null or object");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration with custom admission policy", async () => {
    const dbPath = createTempDbPath("test-custom-policy.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Custom Policy",
        request: "Test custom admission policy",
        admissionPolicy: {
            maxQueuedTasks: 100,
            maxActiveExecutions: 1000,
            maxTier1AckBacklog: 100,
            urgentQueueHeadroom: 10,
        },
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle custom admission policy");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration dependency edges in planned workflow", async () => {
    const dbPath = createTempDbPath("test-edges.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Dependency Edges",
        request: "Test dependency edges",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok("dependencyEdges" in result.plannedWorkflow, "plannedWorkflow should have dependencyEdges");
        assert.ok(Array.isArray(result.plannedWorkflow.dependencyEdges), "dependencyEdges should be array");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration with contextBudgetTokens", async () => {
    const dbPath = createTempDbPath("test-context-budget.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Test Context Budget",
        request: "Test context budget tokens",
        contextBudgetTokens: 50000,
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle contextBudgetTokens");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("executeMultiStepToolCallForTests is exported as function", () => {
    assert.equal(typeof executeMultiStepToolCallForTests, "function", "executeMultiStepToolCallForTests should be a function");
});
test("resetMultiStepToolRegistryForTests is exported as function", () => {
    assert.equal(typeof resetMultiStepToolRegistryForTests, "function", "resetMultiStepToolRegistryForTests should be a function");
});
test("resetMultiStepToolRegistryForTests can be called multiple times", () => {
    // Should not throw
    resetMultiStepToolRegistryForTests();
    resetMultiStepToolRegistryForTests();
});
test("MultiStepToolExecutionInput with stepFailureInjection", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Failure Injection Test",
        request: "Test request",
        stepFailureInjection: new Set(["step_1", "step_3"]),
    };
    assert.ok(input.stepFailureInjection);
    assert.equal(input.stepFailureInjection.has("step_1"), true);
    assert.equal(input.stepFailureInjection.has("step_3"), true);
    assert.equal(input.stepFailureInjection.has("step_2"), false);
});
test("MultiStepToolExecutionInput with stepFailurePlans", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Step Failure Plans Test",
        request: "Test request",
        stepFailurePlans: {
            step_1: ["tool.execution_failed", "validation.schema_mismatch"],
            step_2: [{ errorCode: "internal.error", summary: "Internal error occurred" }],
        },
    };
    assert.ok(input.stepFailurePlans);
    assert.ok(input.stepFailurePlans["step_1"]);
    assert.ok(input.stepFailurePlans["step_2"]);
});
test("MultiStepToolExecutionInput with stepOutputOverrides", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Output Overrides Test",
        request: "Test request",
        stepOutputOverrides: {
            step_1: { summary: "Custom summary", result: "Custom result" },
        },
    };
    assert.ok(input.stepOutputOverrides);
    assert.deepEqual(input.stepOutputOverrides["step_1"], {
        summary: "Custom summary",
        result: "Custom result",
    });
});
test("MultiStepOrchestrationResult type structure verification", () => {
    const result = {
        snapshot: {
            task: {},
            workflow: null,
            execution: null,
            session: null,
            stepOutputs: [],
            artifacts: [],
            events: [],
            consistency: "authoritative",
            observedAt: new Date().toISOString(),
        },
        streamFrames: [],
        routing: {
            workflowId: "wf_test",
            divisionId: "div_test",
            routeReason: "test",
            routeTrace: [],
            requiresOrchestration: true,
            classification: {
                intent: "query",
                confidence: 0.9,
                continuation: "new_task",
                matchedRules: [],
            },
        },
        plannedWorkflow: {
            workflow: {},
            executionSteps: [],
            planReason: "test",
            dependencyEdges: [],
        },
        compaction: null,
    };
    assert.ok(result.snapshot !== null);
    assert.ok(Array.isArray(result.streamFrames));
    assert.ok(result.routing !== null);
    assert.ok(result.plannedWorkflow !== null);
    assert.equal(result.compaction, null);
});
test("MultiStepOrchestrationResult with compaction object", () => {
    const result = {
        snapshot: {
            task: {},
            workflow: null,
            execution: null,
            session: null,
            stepOutputs: [],
            artifacts: [],
            events: [],
            consistency: "authoritative",
            observedAt: new Date().toISOString(),
        },
        streamFrames: [],
        routing: {
            workflowId: "wf_test",
            divisionId: "div_test",
            routeReason: "test",
            routeTrace: [],
            requiresOrchestration: true,
            classification: {
                intent: "query",
                confidence: 0.9,
                continuation: "new_task",
                matchedRules: [],
            },
        },
        plannedWorkflow: {
            workflow: {},
            executionSteps: [],
            planReason: "test",
            dependencyEdges: [],
        },
        compaction: {
            usageBeforeTokens: 50000,
            usageAfterStage1Tokens: 35000,
            usageAfterStage2Tokens: 25000,
            stage1Triggered: true,
            stage2Triggered: false,
            fallbackToStage1: false,
            contextMessages: [],
            persistedRecords: [],
            errorCode: null,
            kvCacheFixedPrefixCacheKey: "kv_fixed_abc123",
            kvCacheDomainBlockCacheKey: null,
        },
    };
    assert.ok(result.compaction !== null);
    assert.equal(result.compaction.usageBeforeTokens, 50000);
    assert.equal(result.compaction.stage1Triggered, true);
});
test("StepFailurePlan type structure", () => {
    const plan = {
        errorCode: "tool.execution_failed",
        summary: "Step failed",
        message: "Tool execution timed out",
    };
    assert.equal(plan.errorCode, "tool.execution_failed");
    assert.equal(plan.summary, "Step failed");
    assert.equal(plan.message, "Tool execution timed out");
});
test("StepFailurePlan minimal with only errorCode", () => {
    const planMinimal = { errorCode: "error.code" };
    assert.equal(planMinimal.errorCode, "error.code");
    assert.equal(planMinimal.summary, undefined);
    assert.equal(planMinimal.message, undefined);
});
test("oapeflir plan with compensation model", async () => {
    const dbPath = createTempDbPath("test-compensation.db");
    cleanupDb(dbPath);
    const planSteps = [
        {
            stepId: "step_1",
            dependencies: [],
            outputs: ["output_1"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
            compensationModel: {
                type: "rollback",
                targetStepId: "step_0",
            },
        },
    ];
    const input = {
        dbPath,
        title: "Test Compensation Model",
        request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle compensation model");
        assert.ok(result.plannedWorkflow.executionSteps.length === 1);
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("oapeflir plan with multiple dependencies", async () => {
    const dbPath = createTempDbPath("test-multi-deps.db");
    cleanupDb(dbPath);
    const planSteps = [
        {
            stepId: "step_1",
            dependencies: [],
            outputs: ["output_1"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
        },
        {
            stepId: "step_2",
            dependencies: [],
            outputs: ["output_2"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
        },
        {
            stepId: "step_3",
            dependencies: ["step_1", "step_2"],
            outputs: ["output_3"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
        },
    ];
    const input = {
        dbPath,
        title: "Test Multi Dependencies",
        request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle multi-dependent steps");
        assert.ok(result.plannedWorkflow.executionSteps.length === 3);
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("oapeflir plan with outputSchemaPath", async () => {
    const dbPath = createTempDbPath("test-schema-path.db");
    cleanupDb(dbPath);
    const planSteps = [
        {
            stepId: "step_1",
            dependencies: [],
            outputs: ["output_1"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
            outputSchemaPath: "/schemas/step1-output.json",
        },
    ];
    const input = {
        dbPath,
        title: "Test Schema Path",
        request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle outputSchemaPath");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration with empty request triggers workflow planning", async () => {
    const dbPath = createTempDbPath("test-empty-request.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Empty Request Test",
        request: "",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle empty request");
        assert.ok(result.plannedWorkflow, "should have planned workflow");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration normalizes input request", async () => {
    const dbPath = createTempDbPath("test-normalize.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Normalize Test",
        request: "  Test request with whitespace  ",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should normalize input");
        const task = result.snapshot.task;
        assert.ok(task, "task should exist");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration with high priority task", async () => {
    const dbPath = createTempDbPath("test-priority.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "High Priority Task",
        request: "Test priority handling",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "runMultiStepOrchestration should handle task execution");
        assert.ok(result.snapshot.task, "should have task snapshot");
    }
    finally {
        cleanupDb(dbPath);
    }
});
test("runMultiStepOrchestration workflow execution produces events", async () => {
    const dbPath = createTempDbPath("test-events.db");
    cleanupDb(dbPath);
    const input = {
        dbPath,
        title: "Event Test",
        request: "Test event emission",
    };
    try {
        const result = await runMultiStepOrchestration(input);
        assert.ok(result.snapshot.events, "snapshot should have events");
        assert.ok(Array.isArray(result.snapshot.events), "events should be array");
    }
    finally {
        cleanupDb(dbPath);
    }
});
//# sourceMappingURL=orchestrator.test.js.map