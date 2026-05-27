import assert from "node:assert/strict";
import test from "node:test";

import { HITLExplainabilityService } from "../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { join } from "node:path";
import type { TakeoverSessionRecord } from "../../../src/platform/contracts/types/domain.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "hitl.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("HITLExplainabilityService can be instantiated [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-instantiate-");
  try {
    const service = new HITLExplainabilityService(h.store);
    assert.ok(service !== undefined);
    assert.equal(service.isEnabled(), true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("generateExplanation creates a decision explanation [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-generate-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const explanation = service.generateExplanation(
      "task_123",
      "task_escalation",
      [
        { name: "complexity", weight: 0.5, value: 8, reason: "High complexity" },
        { name: "duration", weight: 0.5, value: 300, reason: "Exceeded timeout" },
      ],
      { executionId: "exec_123" },
    );

    assert.ok(explanation !== undefined);
    assert.equal(explanation.taskId, "task_123");
    assert.equal(explanation.decisionType, "task_escalation");
    assert.ok(explanation.confidenceScore >= 0 && explanation.confidenceScore <= 1);
    assert.ok(explanation.explanationId.startsWith("explain_"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("explainTaskEscalation generates escalation explanation [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-escalation-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const explanation = service.explainTaskEscalation(
      "task_456",
      { complexity: 9, duration: 600, expectedDuration: 300, errorRate: 25 },
      { executionId: "exec_456" },
    );

    assert.ok(explanation !== undefined);
    assert.equal(explanation.taskId, "task_456");
    assert.equal(explanation.decisionType, "task_escalation");
    assert.equal(explanation.executionId, "exec_456");
    assert.ok(explanation.factors.length >= 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("explainApprovalRequired generates approval explanation [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-approval-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const explanation = service.explainApprovalRequired(
      "task_789",
      { riskLevel: "high", policy: "sensitive_data_policy", classification: "confidential" },
      { takeoverSessionId: "session_123" },
    );

    assert.ok(explanation !== undefined);
    assert.equal(explanation.taskId, "task_789");
    assert.equal(explanation.decisionType, "approval_required");
    assert.equal(explanation.takeoverSessionId, "session_123");
    assert.ok(explanation.factors.length >= 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getExplanation retrieves explanation by id [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-get-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const created = service.generateExplanation(
      "task_get",
      "anomaly_detected",
      [{ name: "metric", weight: 1.0, value: 999, reason: "Anomaly" }],
    );

    const retrieved = service.getExplanation(created.explanationId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved!.explanationId, created.explanationId);
    assert.equal(retrieved!.taskId, "task_get");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getExplanation returns null for unknown id [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-get-unknown-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const result = service.getExplanation("explain_unknown");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getExplanationsForTask filters by task id [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-for-task-");
  try {
    const service = new HITLExplainabilityService(h.store);
    service.generateExplanation("task_filter", "task_escalation", [
      { name: "c", weight: 1, value: 1, reason: "x" },
    ]);
    service.generateExplanation("task_filter", "confidence_low", [
      { name: "c", weight: 1, value: 0.3, reason: "y" },
    ]);
    service.generateExplanation("task_other", "anomaly_detected", [
      { name: "m", weight: 1, value: 100, reason: "z" },
    ]);

    const explanations = service.getExplanationsForTask("task_filter");
    assert.equal(explanations.length, 2);
    assert.ok(explanations.every((e) => e.taskId === "task_filter"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getRecentExplanations respects limit [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-recent-");
  try {
    const service = new HITLExplainabilityService(h.store);
    for (let i = 0; i < 10; i++) {
      service.generateExplanation(`task_${i}`, "task_escalation", [
        { name: "c", weight: 1, value: i, reason: "x" },
      ]);
    }

    const recent = service.getRecentExplanations(5);
    assert.equal(recent.length, 5);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("recordFeedback creates feedback record [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-feedback-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const feedback = service.recordFeedback(5, "satisfaction", "operator_1", {
      takeoverSessionId: "session_fb",
      taskId: "task_fb",
      comment: "Great job",
      categories: ["decision_quality", "response_time"],
      followUpRequested: false,
    });

    assert.ok(feedback !== undefined);
    assert.equal(feedback.rating, 5);
    assert.equal(feedback.feedbackType, "satisfaction");
    assert.equal(feedback.operatorId, "operator_1");
    assert.equal(feedback.takeoverSessionId, "session_fb");
    assert.equal(feedback.taskId, "task_fb");
    assert.ok(feedback.feedbackId.startsWith("fb_"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getFeedbackForSession filters by session id [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-fb-session-");
  try {
    const service = new HITLExplainabilityService(h.store);
    service.recordFeedback(4, "satisfaction", "op1", { takeoverSessionId: "session_a" });
    service.recordFeedback(3, "frustration", "op2", { takeoverSessionId: "session_a" });
    service.recordFeedback(5, "satisfaction", "op3", { takeoverSessionId: "session_b" });

    const sessionA = service.getFeedbackForSession("session_a");
    assert.equal(sessionA.length, 2);
    assert.ok(sessionA.every((f) => f.takeoverSessionId === "session_a"));

    const sessionB = service.getFeedbackForSession("session_b");
    assert.equal(sessionB.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getFeedbackForTask filters by task id [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-fb-task-");
  try {
    const service = new HITLExplainabilityService(h.store);
    service.recordFeedback(5, "satisfaction", "op1", { taskId: "task_x" });
    service.recordFeedback(4, "satisfaction", "op2", { taskId: "task_x" });
    service.recordFeedback(3, "satisfaction", "op3", { taskId: "task_y" });

    const taskX = service.getFeedbackForTask("task_x");
    assert.equal(taskX.length, 2);
    assert.ok(taskX.every((f) => f.taskId === "task_x"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getOperatorMetrics calculates correct metrics [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-metrics-");
  try {
    const service = new HITLExplainabilityService(h.store);
    service.recordFeedback(5, "satisfaction", "op_metrics", { categories: ["decision_quality"] });
    service.recordFeedback(4, "satisfaction", "op_metrics", { categories: ["response_time"] });
    service.recordFeedback(3, "frustration", "op_metrics", { categories: ["clarity", "tooling"] });

    const metrics = service.getOperatorMetrics("op_metrics");
    assert.equal(metrics.operatorId, "op_metrics");
    assert.equal(metrics.totalInterventions, 3);
    assert.ok(metrics.averageRating !== null);
    assert.ok(metrics.averageRating! > 0);
    assert.ok(metrics.recentRatings.length <= 10);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getOperatorMetrics returns defaults for unknown operator [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-metrics-unknown-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const metrics = service.getOperatorMetrics("unknown_operator");
    assert.equal(metrics.operatorId, "unknown_operator");
    assert.equal(metrics.totalInterventions, 0);
    assert.equal(metrics.averageRating, null);
    assert.equal(metrics.recentRatings.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getOverallSatisfactionMetrics returns aggregate metrics [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-overall-");
  try {
    const service = new HITLExplainabilityService(h.store);
    service.recordFeedback(5, "satisfaction", "op1", { categories: ["decision_quality"] });
    service.recordFeedback(4, "satisfaction", "op2", { categories: ["response_time"] });
    service.recordFeedback(3, "frustration", "op3", { categories: ["clarity"] });

    const overall = service.getOverallSatisfactionMetrics();
    assert.equal(overall.totalFeedback, 3);
    assert.ok(overall.averageRating !== null);
    assert.ok(overall.averageRating! > 0);
    assert.ok(overall.ratingDistribution[5] === 1);
    assert.ok(overall.ratingDistribution[3] === 1);
    assert.ok(overall.feedbackTypeDistribution.satisfaction === 2);
    assert.ok(overall.feedbackTypeDistribution.frustration === 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getOverallSatisfactionMetrics returns defaults for empty records [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-overall-empty-");
  try {
    const service = new HITLExplainabilityService(h.store);
    const overall = service.getOverallSatisfactionMetrics();
    assert.equal(overall.totalFeedback, 0);
    assert.equal(overall.averageRating, null);
    assert.equal(overall.ratingDistribution[1], 0);
    assert.equal(overall.ratingDistribution[5], 0);
    assert.equal(overall.feedbackTypeDistribution.satisfaction, 0);
    assert.equal(overall.commonCategories.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("isFeedbackDue returns true when feedback is due [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-feedback-due-");
  try {
    const service = new HITLExplainabilityService(h.store, {
      feedbackReminderAfterMs: 1000,
    });

    const session: TakeoverSessionRecord = {
      id: "session_due",
      taskId: "task_due",
      executionId: null,
      operatorId: "system",
      status: "open",
      reasonCode: "test",
      startedAt: new Date().toISOString(),
      closedAt: new Date(Date.now() - 2000).toISOString(),
    };

    assert.equal(service.isFeedbackDue(session), true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("isFeedbackDue returns false when feedback already submitted [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-feedback-submitted-");
  try {
    const service = new HITLExplainabilityService(h.store, {
      feedbackReminderAfterMs: 1000,
    });

    const session: TakeoverSessionRecord = {
      id: "session_submitted",
      taskId: "task_submitted",
      executionId: null,
      operatorId: "system",
      status: "open",
      reasonCode: "test",
      startedAt: new Date().toISOString(),
      closedAt: new Date(Date.now() - 2000).toISOString(),
    };

    service.recordFeedback(5, "satisfaction", "op1", { takeoverSessionId: "session_submitted" });

    assert.equal(service.isFeedbackDue(session), false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("isFeedbackDue returns false when session not closed [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-feedback-open-");
  try {
    const service = new HITLExplainabilityService(h.store, {
      feedbackReminderAfterMs: 1000,
    });

    const session: TakeoverSessionRecord = {
      id: "session_open",
      taskId: "task_open",
      executionId: null,
      operatorId: "system",
      status: "open",
      reasonCode: "test",
      startedAt: new Date().toISOString(),
      closedAt: null,
    };

    assert.equal(service.isFeedbackDue(session), false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getConfig returns service configuration [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-config-");
  try {
    const service = new HITLExplainabilityService(h.store, {
      enableDecisionExplanations: true,
      enableSatisfactionTracking: true,
      enableFeedbackLoop: false,
      minConfidenceForAutoExplain: 0.7,
      feedbackReminderAfterMs: 600000,
    });

    const config = service.getConfig();
    assert.equal(config.enableDecisionExplanations, true);
    assert.equal(config.enableSatisfactionTracking, true);
    assert.equal(config.enableFeedbackLoop, false);
    assert.equal(config.minConfidenceForAutoExplain, 0.7);
    assert.equal(config.feedbackReminderAfterMs, 600000);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("disabled service does not store explanations [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-disabled-");
  try {
    const service = new HITLExplainabilityService(h.store, {
      enableDecisionExplanations: false,
      enableSatisfactionTracking: false,
      enableFeedbackLoop: false,
    });

    const explanation = service.generateExplanation(
      "task_disabled",
      "task_escalation",
      [{ name: "c", weight: 1, value: 1, reason: "x" }],
    );

    const retrieved = service.getExplanation(explanation.explanationId);
    assert.equal(retrieved, null);

    const recent = service.getRecentExplanations();
    assert.equal(recent.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("disabled service does not store feedback [hitl-explainability-service]", () => {
  const h = createHarness("aa-hitl-fb-disabled-");
  try {
    const service = new HITLExplainabilityService(h.store, {
      enableDecisionExplanations: false,
      enableSatisfactionTracking: false,
      enableFeedbackLoop: false,
    });

    service.recordFeedback(5, "satisfaction", "op_disabled");

    const metrics = service.getOverallSatisfactionMetrics();
    assert.equal(metrics.totalFeedback, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
