import assert from "node:assert/strict";
import test from "node:test";
import { validateTaskSituation, validateUnifiedAssessment, validatePlan, validateStepOutputs, validateFeedbackSignals, validateImprovementCandidates, validateLearningObjects, validateRolloutRecord, validateLearningSignalsArray, BOUNDARY_STRATEGY, } from "../../../../../../src/platform/orchestration/oapeflir/schemas/validators.js";
test("BOUNDARY_STRATEGY has correct strategies for each boundary", () => {
    assert.equal(BOUNDARY_STRATEGY["O→A"], "degrade");
    assert.equal(BOUNDARY_STRATEGY["A→P"], "default");
    assert.equal(BOUNDARY_STRATEGY["P→E"], "abort");
    assert.equal(BOUNDARY_STRATEGY["E→F"], "skip");
    assert.equal(BOUNDARY_STRATEGY["F→L"], "skip");
    assert.equal(BOUNDARY_STRATEGY["L→I"], "skip");
    assert.equal(BOUNDARY_STRATEGY["I→R"], "skip");
});
test("validateTaskSituation returns ok for valid data", () => {
    const validData = {
        taskId: "task_123",
        timestamp: Date.now(),
        objective: "Test objective",
        currentPhase: "planning",
        userIntent: {
            raw: "Test user intent",
            normalized: "test user intent",
            confidence: 0.9,
        },
        blockers: [],
        codebaseSnapshot: {
            rootPath: "/test",
            fileCount: 10,
            relevantFiles: [],
        },
        environmentContext: {
            nodeVersion: "20.0.0",
            platform: "darwin",
            workingDirectory: "/test",
            availableTools: [],
        },
        historicalContext: {
            previousTaskIds: [],
            relatedMemoryRefs: [],
        },
    };
    const result = validateTaskSituation(validData);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.taskId, "task_123");
    }
});
test("validateTaskSituation returns error for invalid data", () => {
    const invalidData = {
        situation: 123, // should be string
    };
    const result = validateTaskSituation(invalidData);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.ok(result.error);
        assert.equal(result.skipped, undefined);
    }
});
test("validateUnifiedAssessment returns ok for valid data", () => {
    const validData = {
        taskId: "task_123",
        timestamp: Date.now(),
        situationRef: "situation_1",
        phase: "pre-execution",
        complexity: "moderate",
        risk: "medium",
        riskAssessment: {
            level: "medium",
            factors: [],
        },
        routingDecision: {
            division: "core",
            workflow: "standard",
            rationale: "Normal routing",
        },
        resourceAllocation: {
            modelClass: "generalist",
            maxTokens: 8000,
            timeoutMs: 60000,
        },
        approvalPolicy: {
            required: false,
        },
        executionMode: "auto",
        suggestedActions: [],
    };
    const result = validateUnifiedAssessment(validData);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.taskId, "task_123");
    }
});
test("validateUnifiedAssessment returns error for invalid data", () => {
    const invalidData = {
        taskId: "task_123",
        // missing required fields
    };
    const result = validateUnifiedAssessment(invalidData);
    assert.equal(result.ok, false);
});
test("validatePlan returns ok for valid plan", () => {
    const validPlan = {
        planId: "plan_123",
        taskId: "task_123",
        version: 1,
        assessmentRef: "assess_123",
        strategy: "linear",
        steps: [
            {
                stepId: "step_1",
                action: "test_action",
                inputs: {},
                outputs: undefined,
                dependencies: [],
                status: "pending",
                timeout: 120_000,
                retryPolicy: { maxRetries: 0, backoffMs: 0 },
            },
        ],
        createdAt: Date.now(),
    };
    const result = validatePlan(validPlan);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.planId, "plan_123");
    }
});
test("validatePlan returns error for invalid plan", () => {
    const invalidPlan = {
        taskId: "task_123",
        // missing planId and other required fields
    };
    const result = validatePlan(invalidPlan);
    assert.equal(result.ok, false);
});
test("validateStepOutputs returns ok for valid step outputs", () => {
    const validOutputs = [
        {
            stepId: "step_1",
            planRef: "plan_1",
            userFacingResult: {
                summary: "Test step completed",
                artifacts: [],
            },
            systemTelemetry: {
                durationMs: 100,
                tokensUsed: 50,
                modelId: "test-model",
                retryCount: 0,
                validationPassed: true,
            },
        },
    ];
    const result = validateStepOutputs(validOutputs);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.length, 1);
    }
});
test("validateStepOutputs handles non-array input", () => {
    const result = validateStepOutputs("not an array");
    assert.equal(result.ok, true); // function converts to array
    if (result.ok) {
        assert.deepEqual(result.value, []);
    }
});
test("validateFeedbackSignals returns ok for valid signals", () => {
    const validSignals = [
        {
            signalId: "sig_1",
            taskId: "task_123",
            source: "execution",
            category: "success",
            severity: "info",
            payload: {},
            stepOutputRefs: [],
            timestamp: Date.now(),
        },
    ];
    const result = validateFeedbackSignals(validSignals);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.length, 1);
    }
});
test("validateFeedbackSignals handles non-array input", () => {
    const result = validateFeedbackSignals(null);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.deepEqual(result.value, []);
    }
});
test("validateImprovementCandidates returns ok for valid candidates", () => {
    const validCandidates = [
        {
            candidateId: "cand_1",
            taskId: "task_123",
            sourceSignalRefs: [],
            sourceLearningObjectIds: [],
            changeScope: "workflow",
            description: "Improve workflow",
            expectedBenefit: "Better performance",
            status: "proposed",
            createdAt: Date.now(),
        },
    ];
    const result = validateImprovementCandidates(validCandidates);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.length, 1);
    }
});
test("validateLearningObjects returns ok for valid objects", () => {
    const validObjects = [
        {
            learningObjectId: "lo_1",
            learningType: "failure_pattern",
            title: "Test",
            summary: "Test summary",
            confidence: 0.8,
            evidenceRefs: [],
            sourceSignalIds: [],
            recommendation: "Fix it",
            validatedBy: "evidence",
            promotionStatus: "validated",
            createdAt: Date.now(),
        },
    ];
    const result = validateLearningObjects(validObjects);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.length, 1);
    }
});
test("validateRolloutRecord returns ok for valid record", () => {
    const validRecord = {
        recordId: "rec_1",
        candidateId: "cand_1",
        level: "canary_5",
        previousLevel: "off",
        strategyVersionId: null,
        status: "shadow",
        transitionedAt: Date.now(),
    };
    const result = validateRolloutRecord(validRecord);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.recordId, "rec_1");
    }
});
test("validateRolloutRecord returns error for invalid record", () => {
    const invalidRecord = {
        candidateId: "cand_1",
        // missing recordId and other required fields
    };
    const result = validateRolloutRecord(invalidRecord);
    assert.equal(result.ok, false);
});
test("validateLearningSignalsArray returns ok for non-empty array", () => {
    const result = validateLearningSignalsArray([{ signalId: "sig_1" }, { signalId: "sig_2" }]);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.length, 2);
    }
});
test("validateLearningSignalsArray returns skipped for empty array", () => {
    const result = validateLearningSignalsArray([]);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateLearningSignalsArray returns skipped for non-array input when strategy is skip", () => {
    // F→L boundary has "skip" strategy
    const result = validateLearningSignalsArray("not an array");
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateLearningSignalsArray returns skipped for empty array when strategy is skip", () => {
    // F→L boundary has "skip" strategy
    const result = validateLearningSignalsArray([]);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateTaskSituation catch block handles non-object input", () => {
    // This test exercises the catch block at lines 81-87 in validators.ts
    // by providing data that will fail Zod validation
    const invalidData = {
        taskId: "", // empty string fails z.string().min(1)
        timestamp: Date.now(),
        objective: "Test objective",
        currentPhase: "planning",
        userIntent: {
            raw: "Test user intent",
            normalized: "test user intent",
            confidence: 0.9,
        },
        blockers: [],
        codebaseSnapshot: {
            rootPath: "/test",
            fileCount: 10,
            relevantFiles: [],
        },
        environmentContext: {
            nodeVersion: "20.0.0",
            platform: "darwin",
            workingDirectory: "/test",
            availableTools: [],
        },
        historicalContext: {
            previousTaskIds: [],
            relatedMemoryRefs: [],
        },
    };
    const result = validateTaskSituation(invalidData);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.ok(result.error);
        assert.equal(result.skipped, undefined);
    }
});
test("validateUnifiedAssessment catch block handles missing required fields", () => {
    // Exercise catch block at lines 89-100
    const invalidData = {
        taskId: "task_123",
        // missing all required fields
        timestamp: Date.now(),
    };
    const result = validateUnifiedAssessment(invalidData);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.ok(result.error);
        assert.equal(result.skipped, undefined);
    }
});
test("validatePlan catch block handles missing required fields", () => {
    // Exercise catch block at lines 103-113
    const invalidPlan = {
        taskId: "task_123",
        // missing planId, version, assessmentRef, strategy, steps, createdAt
    };
    const result = validatePlan(invalidPlan);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.ok(result.error);
        assert.equal(result.skipped, undefined);
    }
});
test("validateRolloutRecord catch block returns skipped when strategy is skip", () => {
    // I→R boundary has "skip" strategy, so validation failure returns skipped
    const invalidRecord = {
        recordId: "rec_1",
        // missing candidateId, level, transitionedAt
    };
    const result = validateRolloutRecord(invalidRecord);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateStepOutputs catch block returns skipped when strategy is skip", () => {
    // E→F boundary has "skip" strategy
    const invalidOutputs = [
        {
            stepId: "step_1",
            // planRef missing - required field
            userFacingResult: {
                summary: "Test summary",
                artifacts: [],
            },
            systemTelemetry: {
                durationMs: 100,
                tokensUsed: 50,
                modelId: "test-model",
                retryCount: 0,
                validationPassed: true,
            },
        },
    ];
    const result = validateStepOutputs(invalidOutputs);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateFeedbackSignals catch block returns skipped when strategy is skip", () => {
    // E→F boundary has "skip" strategy
    const invalidSignals = [
        {
            signalId: "sig_1",
            taskId: "task_123",
            source: "invalid_source", // invalid enum value
            category: "success",
            severity: "info",
            payload: {},
            stepOutputRefs: [],
            timestamp: Date.now(),
        },
    ];
    const result = validateFeedbackSignals(invalidSignals);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateImprovementCandidates catch block returns skipped when strategy is skip", () => {
    // L→I boundary has "skip" strategy
    const invalidCandidates = [
        {
            candidateId: "cand_1",
            taskId: "task_123",
            sourceSignalRefs: [],
            sourceLearningObjectIds: [],
            changeScope: "invalid_scope", // invalid enum value
            description: "Improve workflow",
            expectedBenefit: "Better performance",
            status: "proposed",
            createdAt: Date.now(),
        },
    ];
    const result = validateImprovementCandidates(invalidCandidates);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
test("validateLearningObjects catch block returns skipped when strategy is skip", () => {
    // L→I boundary has "skip" strategy
    const invalidObjects = [
        {
            learningObjectId: "", // fails z.string().min(1)
            learningType: "failure_pattern",
            title: "Test",
            summary: "Test summary",
            confidence: 0.8,
            evidenceRefs: [],
            sourceSignalIds: [],
            recommendation: "Fix it",
            validatedBy: "evidence",
            promotionStatus: "validated",
            createdAt: Date.now(),
        },
    ];
    const result = validateLearningObjects(invalidObjects);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.skipped, true);
    }
});
// Additional tests to improve branch coverage for O→A and A→P boundaries
// These boundaries have strategy !== "skip", so the else branch must be exercised
test("validateTaskSituation catch block exercises else branch for degrade strategy (O→A)", () => {
    // O→A has strategy "degrade", so when catch block is entered,
    // the else branch (return error) should be taken, not the skip branch
    // Pass completely invalid data to ensure Zod throws
    const result = validateTaskSituation(null);
    assert.equal(result.ok, false);
    if (!result.ok) {
        // strategy is "degrade", not "skip", so skipped should be undefined
        assert.equal(result.skipped, undefined);
        assert.ok(result.error);
    }
});
test("validateUnifiedAssessment catch block exercises else branch for default strategy (A→P)", () => {
    // A→P has strategy "default", so when catch block is entered,
    // the else branch (return error) should be taken, not the skip branch
    const result = validateUnifiedAssessment(123); // Pass primitive to ensure Zod throws
    assert.equal(result.ok, false);
    if (!result.ok) {
        // strategy is "default", not "skip", so skipped should be undefined
        assert.equal(result.skipped, undefined);
        assert.ok(result.error);
    }
});
test("validatePlan catch block exercises else branch for abort strategy (P→E)", () => {
    // P→E has strategy "abort", so when catch block is entered,
    // the else branch (return error) should be taken, not the skip branch
    const result = validatePlan(undefined);
    assert.equal(result.ok, false);
    if (!result.ok) {
        // strategy is "abort", not "skip", so skipped should be undefined
        assert.equal(result.skipped, undefined);
        assert.ok(result.error);
    }
});
//# sourceMappingURL=validators.test.js.map