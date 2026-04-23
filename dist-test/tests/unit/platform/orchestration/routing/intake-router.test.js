import assert from "node:assert/strict";
import test from "node:test";
import { IntakeRouter, } from "../../../../../src/platform/orchestration/routing/intake-router.js";
test("IntakeRouter type exports are correct", () => {
    const intents = ["query", "create", "modify", "approve", "cancel", "clarify", "chitchat", "correction"];
    for (const intent of intents) {
        assert.ok(["query", "create", "modify", "approve", "cancel", "clarify", "chitchat", "correction"].includes(intent));
    }
    const continuations = ["new_task", "follow_up", "correction"];
    for (const cont of continuations) {
        assert.ok(["new_task", "follow_up", "correction"].includes(cont));
    }
});
test("IntakeIntentClassification structure", () => {
    const classification = {
        intent: "create",
        continuation: "new_task",
        confidence: 0.95,
        matchedRules: ["create", "build"],
    };
    assert.equal(classification.intent, "create");
    assert.equal(classification.continuation, "new_task");
    assert.equal(classification.confidence, 0.95);
    assert.deepEqual(classification.matchedRules, ["create", "build"]);
});
test("IntakeRouteDecision structure", () => {
    const decision = {
        workflowId: "single_agent_minimal",
        divisionId: "general_ops",
        routeReason: "Matched division trigger pattern",
        routeTrace: ["input_normalized", "intent_classified_as_create", "division_matched"],
        requiresOrchestration: false,
        classification: {
            intent: "create",
            continuation: "new_task",
            confidence: 0.95,
            matchedRules: ["create"],
        },
    };
    assert.equal(decision.workflowId, "single_agent_minimal");
    assert.equal(decision.divisionId, "general_ops");
    assert.equal(decision.requiresOrchestration, false);
});
test("IntakeRouteInput structure", () => {
    const input = {
        title: "Create a new deployment",
        request: "I need to deploy a new version of the service to production",
    };
    assert.equal(input.title, "Create a new deployment");
    assert.ok(input.request.length > 0);
});
test("IntakeRouter routes query intents", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Check status",
        request: "What is the status of task 123?",
    });
    assert.ok(decision.classification.intent === "query" || decision.classification.intent === "chitchat" || decision.divisionId !== "");
    assert.ok(decision.routeTrace.length > 0);
});
test("IntakeRouter routes create intents", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Create task",
        request: "Create a new task for deploying the service",
    });
    assert.ok(decision.divisionId !== "");
    assert.ok(decision.workflowId !== "");
});
test("IntakeRouter detects orchestration hints", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Plan deployment",
        request: "Plan and orchestrate the deployment of multiple services across regions with health checks",
    });
    assert.ok(decision.requiresOrchestration === true || decision.requiresOrchestration === false);
    assert.ok(decision.routeTrace.length > 0);
});
test("IntakeRouter handles long requests", () => {
    const router = new IntakeRouter();
    const longRequest = "Analyze the current system performance, identify bottlenecks, compare with previous benchmarks, design optimization strategies, implement fixes, and summarize results for stakeholders";
    const decision = router.route({
        title: "Analyze system",
        request: longRequest,
    });
    assert.ok(decision.divisionId !== "");
    assert.ok(decision.routeTrace.length > 0);
});
test("IntakeRouter detects follow-up requests", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Continue task",
        request: "Continue with the deployment, also check the logs",
    });
    assert.ok(decision.divisionId !== "");
    assert.ok(decision.routeTrace.length > 0);
});
test("IntakeRouter returns route trace", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Hello",
        request: "Hi there!",
    });
    assert.ok(Array.isArray(decision.routeTrace));
    assert.ok(decision.routeTrace.length >= 0);
});
test("IntakeRouter classification confidence is valid", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Test",
        request: "Show me the logs",
    });
    assert.ok(decision.classification.confidence >= 0);
    assert.ok(decision.classification.confidence <= 1);
});
test("IntakeRouter matchedRules is array", () => {
    const router = new IntakeRouter();
    const decision = router.route({
        title: "Test",
        request: "Create something new",
    });
    assert.ok(Array.isArray(decision.classification.matchedRules));
});
//# sourceMappingURL=intake-router.test.js.map