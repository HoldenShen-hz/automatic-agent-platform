import test from "node:test";
import assert from "node:assert/strict";
import { ReplanningService } from "../../../../../src/platform/orchestration/planner/replanning-service.js";
test("ReplanningService requests new plan version for repairable feedback", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_1",
        taskId: "task_1",
        assessmentRef: "assessment:task_1:1",
        version: 2,
        strategy: "linear",
        steps: [
            {
                stepId: "step_1",
                action: "read",
                title: "Do work",
                inputs: {},
                outputs: [],
                dependencies: [],
                status: "pending",
                timeout: 1000,
                retryPolicy: {
                    maxRetries: 0,
                    backoffMs: 0,
                },
            },
        ],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_1",
        taskId: "task_1",
        executionId: null,
        planId: "plan_1",
        outcome: "repairable",
        signals: [],
        emittedAt: Date.now(),
    });
    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.nextPlanVersion, 3);
    assert.equal(decision.strategy, "replanned");
});
test("ReplanningService does not replan for successful completion", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_2",
        taskId: "task_2",
        assessmentRef: "assessment:task_2:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_2",
        taskId: "task_2",
        executionId: null,
        planId: "plan_2",
        outcome: "completed",
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_2",
                category: "success",
                severity: "info",
                payload: { summary: "task completed" },
                stepOutputRefs: [],
                timestamp: Date.now(),
            },
        ],
        emittedAt: Date.now(),
    });
    assert.equal(decision.shouldReplan, false);
});
test("ReplanningService replans for failed outcome", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_3",
        taskId: "task_3",
        assessmentRef: "assessment:task_3:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_3",
        taskId: "task_3",
        executionId: null,
        planId: "plan_3",
        outcome: "failed",
        signals: [
            {
                signalId: "sig_2",
                source: "execution",
                taskId: "task_3",
                category: "failure",
                severity: "error",
                payload: { summary: "execution failed" },
                stepOutputRefs: [],
                timestamp: Date.now(),
            },
        ],
        emittedAt: Date.now(),
    });
    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.nextPlanVersion, 2);
});
test("ReplanningService uses retry strategy for transient failures", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_4",
        taskId: "task_4",
        assessmentRef: "assessment:task_4:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_4",
        taskId: "task_4",
        executionId: null,
        planId: "plan_4",
        outcome: "failed",
        signals: [
            {
                signalId: "sig_3",
                source: "execution",
                taskId: "task_4",
                category: "failure",
                severity: "warning",
                payload: { summary: "transient failure", reasonCode: "transient.timeout" },
                stepOutputRefs: [],
                timestamp: Date.now(),
            },
        ],
        emittedAt: Date.now(),
    });
    assert.equal(decision.shouldReplan, true);
});
test("ReplanningService replans for escalated outcome", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_5",
        taskId: "task_5",
        assessmentRef: "assessment:task_5:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_5",
        taskId: "task_5",
        executionId: null,
        planId: "plan_5",
        outcome: "escalated",
        signals: [],
        emittedAt: Date.now(),
    });
    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.reasonCode, "planning.execution_deviation");
});
test("ReplanningService replans when feedback has correction category signal", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_6",
        taskId: "task_6",
        assessmentRef: "assessment:task_6:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_6",
        taskId: "task_6",
        executionId: null,
        planId: "plan_6",
        outcome: "completed",
        signals: [
            {
                signalId: "sig_correction",
                source: "user",
                taskId: "task_6",
                category: "correction",
                severity: "warning",
                payload: { summary: "user corrected the approach" },
                stepOutputRefs: [],
                timestamp: Date.now(),
            },
        ],
        emittedAt: Date.now(),
    });
    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.strategy, "replanned");
});
test("ReplanningService uses trigger reasonCode when provided", () => {
    const service = new ReplanningService();
    const trigger = service.createTrigger("task_7", "planning.user_requested", "operator", "User requested replan");
    const decision = service.decide({
        planId: "plan_7",
        taskId: "task_7",
        assessmentRef: "assessment:task_7:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_7",
        taskId: "task_7",
        executionId: null,
        planId: "plan_7",
        outcome: "repairable",
        signals: [],
        emittedAt: Date.now(),
    }, trigger);
    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.reasonCode, "planning.user_requested");
});
test("ReplanningService.createTrigger creates valid trigger", () => {
    const service = new ReplanningService();
    const trigger = service.createTrigger("task_trigger", "planning.feedback_trigger", "feedback", "Feedback triggered replan");
    assert.ok(trigger.triggerId.startsWith("replan_trigger_"), `Expected triggerId to start with replan_trigger_, got ${trigger.triggerId}`);
    assert.equal(trigger.taskId, "task_trigger");
    assert.equal(trigger.reasonCode, "planning.feedback_trigger");
    assert.equal(trigger.source, "feedback");
    assert.equal(trigger.summary, "Feedback triggered replan");
});
test("ReplanningService decides uses fallback reasonCode when trigger is null", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_fallback_null",
        taskId: "task_fallback_null",
        assessmentRef: "assessment:task_fallback_null:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_fallback_null",
        taskId: "task_fallback_null",
        executionId: null,
        planId: "plan_fallback_null",
        outcome: "repairable",
        signals: [],
        emittedAt: Date.now(),
    }, null);
    assert.equal(decision.shouldReplan, true);
    // When trigger is null and shouldReplan is true, fallback reasonCode is "planning.execution_deviation"
    assert.equal(decision.reasonCode, "planning.execution_deviation");
});
test("ReplanningService decides uses fallback reasonCode when trigger is undefined", () => {
    const service = new ReplanningService();
    const decision = service.decide({
        planId: "plan_fallback_undef",
        taskId: "task_fallback_undef",
        assessmentRef: "assessment:task_fallback_undef:1",
        version: 1,
        strategy: "linear",
        steps: [],
        createdAt: Date.now(),
    }, {
        feedbackId: "fb_fallback_undef",
        taskId: "task_fallback_undef",
        executionId: null,
        planId: "plan_fallback_undef",
        outcome: "repairable",
        signals: [],
        emittedAt: Date.now(),
    }, undefined);
    assert.equal(decision.shouldReplan, true);
    // When trigger is undefined and shouldReplan is true, fallback reasonCode is "planning.execution_deviation"
    assert.equal(decision.reasonCode, "planning.execution_deviation");
});
//# sourceMappingURL=replanning-service.test.js.map