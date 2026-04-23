import test from "node:test";
import assert from "node:assert/strict";
import { HITLExplainabilityService } from "../../../../../src/platform/orchestration/hitl/hitl-explainability-service.js";
// Mock store for testing
const mockStore = {
    getTask: async () => null,
    insertTask: async () => { },
};
test("HITLExplainabilityService generates explanation for task_escalation", () => {
    const service = new HITLExplainabilityService(mockStore);
    const explanation = service.explainTaskEscalation("task-123", { complexity: 0.9, duration: 120, expectedDuration: 60, errorRate: 25 }, { executionId: "exec-1" });
    assert.equal(explanation.taskId, "task-123");
    assert.equal(explanation.decisionType, "task_escalation");
    assert.ok(explanation.explanationId.startsWith("explain_"));
    assert.ok(explanation.factors.length >= 2);
    assert.ok(explanation.confidenceScore >= 0 && explanation.confidenceScore <= 1);
});
test("HITLExplainabilityService generates explanation for approval_required", () => {
    const service = new HITLExplainabilityService(mockStore);
    const explanation = service.explainApprovalRequired("task-456", { riskLevel: "high", policy: "sensitive-data-policy", classification: "PII" }, { contextSnapshot: { userId: "user-1" } });
    assert.equal(explanation.taskId, "task-456");
    assert.equal(explanation.decisionType, "approval_required");
    assert.ok(explanation.factors.length === 3);
});
test("HITLExplainabilityService records and retrieves feedback", () => {
    const service = new HITLExplainabilityService(mockStore);
    service.recordFeedback(5, "satisfaction", "operator-1", {
        taskId: "task-789",
        comment: "Good decision",
        categories: ["decision_quality", "response_time"],
    });
    const feedback = service.getFeedbackForTask("task-789");
    assert.equal(feedback.length, 1);
    assert.equal(feedback[0]?.rating, 5);
    assert.equal(feedback[0]?.feedbackType, "satisfaction");
});
test("HITLExplainabilityService calculates operator metrics", () => {
    const service = new HITLExplainabilityService(mockStore);
    service.recordFeedback(4, "satisfaction", "operator-x");
    service.recordFeedback(5, "satisfaction", "operator-x");
    service.recordFeedback(2, "frustration", "operator-x", { categories: ["response_time", "tooling"] });
    const metrics = service.getOperatorMetrics("operator-x");
    assert.equal(metrics.operatorId, "operator-x");
    assert.equal(metrics.totalInterventions, 3);
    assert.ok(metrics.averageRating !== null);
    assert.ok(metrics.averageRating > 3 && metrics.averageRating < 4);
    assert.ok(metrics.recentRatings.length <= 10);
});
test("HITLExplainabilityService returns overall satisfaction metrics", () => {
    const service = new HITLExplainabilityService(mockStore);
    service.recordFeedback(5, "satisfaction", "op-1");
    service.recordFeedback(4, "satisfaction", "op-2");
    service.recordFeedback(3, "suggestion", "op-3");
    const metrics = service.getOverallSatisfactionMetrics();
    assert.equal(metrics.totalFeedback, 3);
    assert.ok(metrics.averageRating !== null);
    assert.equal(metrics.ratingDistribution[5], 1);
    assert.equal(metrics.ratingDistribution[4], 1);
    assert.equal(metrics.ratingDistribution[3], 1);
    assert.equal(metrics.feedbackTypeDistribution.satisfaction, 2);
    assert.equal(metrics.feedbackTypeDistribution.suggestion, 1);
});
test("HITLExplainabilityService isFeedbackDue checks elapsed time", () => {
    const service = new HITLExplainabilityService(mockStore, { feedbackReminderAfterMs: 1000 });
    const oldSession = { id: "session-1", closedAt: new Date(Date.now() - 2000).toISOString() };
    assert.equal(service.isFeedbackDue(oldSession), true);
    const recentSession = { id: "session-2", closedAt: new Date().toISOString() };
    assert.equal(service.isFeedbackDue(recentSession), false);
});
test("HITLExplainabilityService getExplanation retrieves stored explanation", () => {
    const service = new HITLExplainabilityService(mockStore);
    const explanation = service.explainTaskEscalation("task-1", { complexity: 0.8 });
    const retrieved = service.getExplanation(explanation.explanationId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved?.taskId, "task-1");
});
test("HITLExplainabilityService getExplanationsForTask filters correctly", () => {
    const service = new HITLExplainabilityService(mockStore);
    service.explainTaskEscalation("task-A", { complexity: 0.9 });
    service.explainApprovalRequired("task-A", { riskLevel: "high" });
    service.explainTaskEscalation("task-B", { complexity: 0.5 });
    const explanations = service.getExplanationsForTask("task-A");
    assert.equal(explanations.length, 2);
});
test("HITLExplainabilityService getRecentExplanations respects limit", () => {
    const service = new HITLExplainabilityService(mockStore);
    for (let i = 0; i < 100; i++) {
        service.explainTaskEscalation(`task-${i}`, { complexity: 0.5 });
    }
    const recent = service.getRecentExplanations(10);
    assert.equal(recent.length, 10);
});
test("HITLExplainabilityService isEnabled reflects config", () => {
    const disabledService = new HITLExplainabilityService(mockStore, {
        enableDecisionExplanations: false,
        enableSatisfactionTracking: false,
    });
    assert.equal(disabledService.isEnabled(), false);
    const enabledService = new HITLExplainabilityService(mockStore, {
        enableDecisionExplanations: true,
        enableSatisfactionTracking: false,
    });
    assert.equal(enabledService.isEnabled(), true);
});
test("HITLExplainabilityService getConfig returns copy of config", () => {
    const service = new HITLExplainabilityService(mockStore, {
        minConfidenceForAutoExplain: 0.8,
        feedbackReminderAfterMs: 60000,
    });
    const config = service.getConfig();
    assert.equal(config.minConfidenceForAutoExplain, 0.8);
    assert.equal(config.feedbackReminderAfterMs, 60000);
    assert.equal(config.enableDecisionExplanations, true);
});
//# sourceMappingURL=hitl-explainability-service.test.js.map