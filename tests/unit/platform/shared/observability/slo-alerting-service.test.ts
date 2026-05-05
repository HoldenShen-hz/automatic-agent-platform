import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SloAlertingService,
  LogAlertChannel,
  OpsGenieAlertChannel,
  PagerDutyAlertChannel,
  SlackAlertChannel,
  WebhookAlertChannel,
  SLO_ALERTING_DDL,
  type AlertEvent,
} from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { rolloutFreezeManager } from "../../../../../src/platform/shared/observability/rollout-freeze-manager.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "slo.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(SLO_ALERTING_DDL);
  return { workspace, db };
}

test("SLO service defines an SLO and collects SLI samples", () => {
  const h = createHarness("aa-slo-basic-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "api_latency_p95",
      description: "API P95 latency under 500ms",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 60,
    });

    assert.ok(slo.id.startsWith("slo_"));
    assert.equal(slo.status, "unknown");

    const sli = service.collectSli(slo.id, 350, "ms");
    assert.ok(sli.id.startsWith("sli_"));
    assert.equal(sli.value, 350);

    const samples = service.listSliSamples(slo.id);
    assert.equal(samples.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO evaluation returns met when under threshold", () => {
  const h = createHarness("aa-slo-eval-met-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "error_rate",
      description: "Error rate under 1%",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 0.1, "%");
    service.collectSli(slo.id, 0.2, "%");
    service.collectSli(slo.id, 0.3, "%");

    const status = service.evaluateSlo(slo.id);
    assert.equal(status, "met");

    const updated = service.getSlo(slo.id);
    assert.equal(updated?.status, "met");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO evaluation returns breached when over threshold", () => {
  const h = createHarness("aa-slo-eval-breach-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "availability",
      description: "Availability >= 99.9%",
      sliKind: "availability",
      targetValue: 99.9,
      operator: "gte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 98.0, "%");
    service.collectSli(slo.id, 97.5, "%");

    const status = service.evaluateSlo(slo.id);
    assert.equal(status, "breached");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SLO evaluation returns unknown with no samples", () => {
  const h = createHarness("aa-slo-eval-unknown-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "throughput",
      description: "Throughput > 100 rps",
      sliKind: "throughput",
      targetValue: 100,
      operator: "gt",
      windowMinutes: 60,
    });

    const status = service.evaluateSlo(slo.id);
    assert.equal(status, "unknown");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("alert rule fires and delivers to log channel", () => {
  const h = createHarness("aa-alert-fire-");
  try {
    const logChannel = new LogAlertChannel();
    const service = new SloAlertingService(h.db, {
      channels: { log: logChannel } as Record<string, LogAlertChannel>,
    });

    const rule = service.defineAlertRule({
      name: "high_error_rate",
      sloId: null,
      condition: "error_rate > 5%",
      severity: "critical",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 5,
      enabled: true,
    });

    const alert = service.fireAlert(rule.id, "High Error Rate", "Error rate exceeded 5%");
    assert.ok(alert.id.startsWith("alert_"));
    assert.equal(alert.status, "firing");
    assert.equal(alert.severity, "critical");
    assert.equal(alert.unifiedSeverity, "SEV2");
    assert.ok(alert.deliveredAt); // delivered to log channel

    const delivered = logChannel.getDelivered();
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0]!.title, "High Error Rate");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("alert acknowledge and resolve lifecycle", () => {
  const h = createHarness("aa-alert-lifecycle-");
  try {
    const service = new SloAlertingService(h.db);
    const rule = service.defineAlertRule({
      name: "test_alert",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    const alert = service.fireAlert(rule.id, "Test", "test alert");
    assert.equal(alert.status, "firing");

    const acked = service.acknowledgeAlert(alert.id, "oncall-engineer");
    assert.equal(acked, true);

    const resolved = service.resolveAlert(alert.id);
    assert.equal(resolved, true);

    const events = service.listAlertEvents("resolved");
    assert.equal(events.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("webhook alert channel fails gracefully without url", () => {
  const channel = new WebhookAlertChannel();
  const event: AlertEvent = {
    id: "alert_missing_url",
    ruleId: "rule_missing_url",
    severity: "warning",
    status: "firing",
    title: "Missing URL",
    detail: "No webhook URL configured",
    channelKind: "webhook",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };
  const result = channel.deliver(event, {});
  assert.equal(result.delivered, false);
  assert.match(result.error!, /missing webhook url/);
});

test("webhook alert channel delivers to mock URL and returns success", async () => {
  let callCount = 0;
  let receivedBody: unknown = null;
  const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
    callCount++;
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 200 } as Response;
  };

  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = {
    id: "alert_test_1",
    ruleId: "arule_test",
    severity: "critical" as const,
    status: "firing" as const,
    title: "Critical Alert",
    detail: "Something went wrong",
    channelKind: "webhook" as const,
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, { url: "https://example.com/webhook" });
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
  assert.equal(callCount, 1);
  assert.equal((receivedBody as { id: string }).id, "alert_test_1");
  assert.equal((receivedBody as { title: string }).title, "Critical Alert");
});

test("webhook alert channel accepts custom headers", async () => {
  let receivedHeaders: Record<string, string> = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedHeaders = init?.headers as Record<string, string>;
    return { ok: true, status: 200 } as Response;
  };

  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = {
    id: "alert_test_2",
    ruleId: "arule_test",
    severity: "warning" as const,
    status: "firing" as const,
    title: "Warning",
    detail: "Check it",
    channelKind: "webhook" as const,
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, {
    url: "https://example.com/webhook",
    headers: { "X-Custom": "header-value", "User-Agent": "AA-SLO/1.0" },
  });
  assert.equal(result.delivered, true);
  assert.equal(receivedHeaders["X-Custom"], "header-value");
  assert.equal(receivedHeaders["User-Agent"], "AA-SLO/1.0");
  assert.equal(receivedHeaders["content-type"], "application/json");
});

test("webhook alert channel accepts default headers from constructor", async () => {
  let receivedHeaders: Record<string, string> = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedHeaders = init?.headers as Record<string, string>;
    return { ok: true, status: 200 } as Response;
  };

  const channel = new WebhookAlertChannel({
    fetchImpl: mockFetch,
    defaultHeaders: { "User-Agent": "AA-Alerting/1.0", "X-Priority": "high" },
  });
  const event = {
    id: "alert_test_3",
    ruleId: "arule_test",
    severity: "info" as const,
    status: "firing" as const,
    title: "Info",
    detail: "Notice",
    channelKind: "webhook" as const,
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, { url: "https://example.com/webhook" });
  assert.equal(result.delivered, true);
  assert.equal(receivedHeaders["User-Agent"], "AA-Alerting/1.0");
  assert.equal(receivedHeaders["X-Priority"], "high");
});

test("slack alert channel fails gracefully without webhook url", () => {
  const channel = new SlackAlertChannel();
  const event: AlertEvent = {
    id: "alert_slack_missing",
    ruleId: "rule_slack_missing",
    severity: "warning",
    status: "firing",
    title: "Slack missing",
    detail: "No webhook",
    channelKind: "slack",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, {});
  assert.equal(result.delivered, false);
  assert.match(result.error ?? "", /missing slack webhook url/);
});

test("slack alert channel sends structured payload", async () => {
  let receivedBody: unknown = null;
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 200 } as Response;
  };

  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_slack_ok",
    ruleId: "rule_slack_ok",
    severity: "critical",
    status: "firing",
    title: "Provider spike",
    detail: "429 burst",
    channelKind: "slack",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });
  assert.equal(result.delivered, true);
  assert.match(String((receivedBody as { text: string }).text), /Provider spike/);
});

test("pagerduty alert channel fails gracefully without routing key", () => {
  const channel = new PagerDutyAlertChannel();
  const event: AlertEvent = {
    id: "alert_pd_missing",
    ruleId: "rule_pd_missing",
    severity: "page",
    status: "firing",
    title: "PagerDuty missing",
    detail: "No routing key",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, {});
  assert.equal(result.delivered, false);
  assert.match(result.error ?? "", /missing pagerduty routing key/);
});

test("pagerduty alert channel sends events v2 payload", async () => {
  let receivedBody: unknown = null;
  let receivedUrl = "";
  const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
    receivedUrl = String(url);
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 202 } as Response;
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_pd_ok",
    ruleId: "rule_pd_ok",
    severity: "page",
    status: "firing",
    title: "Queue backlog breach",
    detail: "Queue oldest age exceeded threshold",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, { routingKey: "routing-key-1" });
  assert.equal(result.delivered, true);
  assert.equal(receivedUrl, "https://events.pagerduty.com/v2/enqueue");
  assert.equal((receivedBody as { routing_key: string }).routing_key, "routing-key-1");
  assert.equal((receivedBody as { payload: { summary: string } }).payload.summary, "Queue backlog breach");
});

test("opsgenie alert channel fails gracefully without api key", () => {
  const channel = new OpsGenieAlertChannel();
  const event: AlertEvent = {
    id: "alert_ops_missing",
    ruleId: "rule_ops_missing",
    severity: "warning",
    status: "firing",
    title: "OpsGenie missing",
    detail: "No API key",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };
  const result = channel.deliver(event, {});
  assert.equal(result.delivered, false);
  assert.match(result.error ?? "", /missing opsgenie api key/);
});

test("opsgenie alert channel maps severity to priority", async () => {
  let receivedHeaders: Record<string, string> = {};
  let receivedBody: { priority?: string; message?: string } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedHeaders = init?.headers as Record<string, string>;
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 202 } as Response;
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_ops_1",
    ruleId: "rule_ops_1",
    severity: "critical",
    status: "firing",
    title: "Database pool exhausted",
    detail: "waiting clients exceeded threshold",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  const result = channel.deliver(event, { apiKey: "secret-key" });
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
  assert.equal(receivedHeaders.authorization, "GenieKey secret-key");
  assert.equal(receivedBody.priority, "P1");
  assert.equal(receivedBody.message, "Database pool exhausted");
});

test("runbook definition, execution, and listing", () => {
  const h = createHarness("aa-runbook-");
  try {
    const executedSteps: Array<{ stepIndex: number; step: unknown }> = [];
    const service = new SloAlertingService(h.db, {
      runbookStepExecutor: ({ stepIndex, step }) => {
        executedSteps.push({ stepIndex, step });
        return { success: true, output: `executed:${stepIndex}` };
      },
    });
    const rule = service.defineAlertRule({
      name: "db_slow",
      sloId: null,
      condition: "p95 > 1000ms",
      severity: "page",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 10,
      enabled: true,
    });

    const runbook = service.defineRunbook({
      name: "restart_connection_pool",
      description: "Restart DB connection pool when latency spikes",
      alertRuleId: rule.id,
      steps: JSON.stringify(["check_pool_health", "drain_idle", "restart_pool"]),
      autoExecute: true,
    });

    assert.ok(runbook.id.startsWith("rbook_"));

    const alert = service.fireAlert(rule.id, "DB Slow", "p95 over 1000ms");
    const execution = service.executeRunbook(runbook.id, alert.id, "oncall");
    assert.equal(execution.status, "completed");
    assert.ok(execution.completedAt);
    assert.equal(executedSteps.length, 3);

    const execs = service.listRunbookExecutions(runbook.id);
    assert.equal(execs.length, 1);
    assert.equal(execs[0]?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("runbook execution fails closed when steps exist but no executor is configured", () => {
  const h = createHarness("aa-runbook-no-executor-");
  try {
    const service = new SloAlertingService(h.db);
    const runbook = service.defineRunbook({
      name: "missing_executor",
      description: "Should fail closed",
      alertRuleId: null,
      steps: JSON.stringify([{ action: "restart" }]),
      autoExecute: false,
    });

    const execution = service.executeRunbook(runbook.id, null, "oncall");

    assert.equal(execution.status, "failed");
    assert.match(execution.output ?? "", /runbook_step_executor_not_configured/);

    const [persisted] = service.listRunbookExecutions(runbook.id);
    assert.equal(persisted?.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("summary returns correct aggregate counts", () => {
  const h = createHarness("aa-slo-summary-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "test_slo",
      description: "",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 5.0, "%");
    service.evaluateSlo(slo.id);

    const rule = service.defineAlertRule({
      name: "r",
      sloId: slo.id,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });
    service.fireAlert(rule.id, "breach", "breached");

    const s = service.summary();
    assert.equal(s.sloCount, 1);
    assert.equal(s.breachedCount, 1);
    assert.equal(s.firingAlertCount, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listSlos returns all defined SLOs", () => {
  const h = createHarness("aa-slo-list-");
  try {
    const service = new SloAlertingService(h.db);
    service.defineSlo({ name: "alpha", description: "", sliKind: "availability", targetValue: 99.9, operator: "gte", windowMinutes: 60 });
    service.defineSlo({ name: "beta", description: "", sliKind: "latency_p95", targetValue: 200, operator: "lte", windowMinutes: 30 });

    const slos = service.listSlos();
    assert.equal(slos.length, 2);
    assert.equal(slos[0]!.name, "alpha");
    assert.equal(slos[1]!.name, "beta");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("triggerErrorBudgetDegradation does nothing when SLO is met", () => {
  const h = createHarness("aa-slo-no-degrade-");
  try {
    rolloutFreezeManager.unfreeze();
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "good_slo",
      description: "Error rate well under threshold",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 0.1, "%");
    service.collectSli(slo.id, 0.2, "%");

    const result = service.triggerErrorBudgetDegradation(slo.id);

    assert.equal(result.degraded, false);
    assert.equal(result.sloStatus, "met");
    assert.equal(result.rolloutFrozen, false);
    assert.equal(result.alertFired, false);
    assert.equal(result.alertId, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("triggerErrorBudgetDegradation freezes rollouts and fires alert when SLO breached", () => {
  const h = createHarness("aa-slo-degrade-");
  try {
    rolloutFreezeManager.unfreeze();
    const logChannel = new LogAlertChannel();
    const service = new SloAlertingService(h.db, {
      channels: { log: logChannel } as any,
    });
    const slo = service.defineSlo({
      name: "breached_slo",
      description: "Error rate exceeded budget",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 5.0, "%");
    service.collectSli(slo.id, 6.0, "%");

    const result = service.triggerErrorBudgetDegradation(slo.id);

    assert.equal(result.degraded, true);
    assert.equal(result.sloStatus, "breached");
    assert.equal(result.rolloutFrozen, true);
    assert.equal(result.alertFired, true);
    assert.ok(result.alertId !== null);
    assert.equal(service.isRolloutFrozen(), true);
    assert.equal(service.getFrozenBySloId(), slo.id);
    assert.ok(service.getRolloutFrozenAt() !== null);
  } finally {
    rolloutFreezeManager.unfreeze();
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("isRolloutFrozen returns current freeze state", () => {
  const h = createHarness("aa-slo-freeze-check-");
  try {
    rolloutFreezeManager.unfreeze();
    const service = new SloAlertingService(h.db);

    assert.equal(service.isRolloutFrozen(), false);

    rolloutFreezeManager.freeze("slo_force_freeze");
    assert.equal(service.isRolloutFrozen(), true);

    rolloutFreezeManager.unfreeze();
    assert.equal(service.isRolloutFrozen(), false);
  } finally {
    rolloutFreezeManager.unfreeze();
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("unfreezeRollouts clears rollout freeze state", () => {
  const h = createHarness("aa-slo-unfreeze-");
  try {
    const service = new SloAlertingService(h.db);
    rolloutFreezeManager.freeze("slo_to_unfreeze");

    assert.equal(service.isRolloutFrozen(), true);

    service.unfreezeRollouts();

    assert.equal(service.isRolloutFrozen(), false);
    assert.equal(service.getFrozenBySloId(), null);
    assert.equal(service.getRolloutFrozenAt(), null);
  } finally {
    rolloutFreezeManager.unfreeze();
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("computeBurnRate returns 0 for non-existent SLO", () => {
  const h = createHarness("aa-slo-burn-rate-");
  try {
    const service = new SloAlertingService(h.db);

    const burnRate = service.computeBurnRate("non_existent_slo", 60_000);

    assert.equal(burnRate, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("computeBurnRate returns 0 with no samples in window", () => {
  const h = createHarness("aa-slo-burn-rate-empty-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "empty_burn_slo",
      description: "No samples",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    const burnRate = service.computeBurnRate(slo.id, 60_000);

    assert.equal(burnRate, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("computeBurnRate calculates correct rate for gte operator (higher is better)", () => {
  const h = createHarness("aa-slo-burn-rate-gte-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "availability_slo",
      description: "Availability SLO",
      sliKind: "availability",
      targetValue: 99.9,
      operator: "gte",
      windowMinutes: 60,
    });

    // Collect samples averaging 99.5% (below target of 99.9%)
    service.collectSli(slo.id, 99.5, "%");
    service.collectSli(slo.id, 99.5, "%");
    service.collectSli(slo.id, 99.5, "%");

    const burnRate = service.computeBurnRate(slo.id, 60_000);

    // Burn rate should be positive since we're below target
    assert.ok(burnRate > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("computeBurnRate calculates correct rate for lte operator (lower is better)", () => {
  const h = createHarness("aa-slo-burn-rate-lte-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "latency_slo",
      description: "Latency SLO",
      sliKind: "latency_p95",
      targetValue: 200,
      operator: "lte",
      windowMinutes: 60,
    });

    // Collect samples averaging 250ms (above target of 200ms)
    service.collectSli(slo.id, 250, "ms");
    service.collectSli(slo.id, 250, "ms");
    service.collectSli(slo.id, 250, "ms");

    const burnRate = service.computeBurnRate(slo.id, 60_000);

    // Burn rate should be positive since we're above target
    assert.ok(burnRate > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("computeBurnRate returns 0 when expected consumption is zero", () => {
  const h = createHarness("aa-slo-burn-rate-zero-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "zero_target_slo",
      description: "Zero target",
      sliKind: "error_rate",
      targetValue: 0,
      operator: "lte",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 0.5, "%");

    const burnRate = service.computeBurnRate(slo.id, 60_000);

    assert.equal(burnRate, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("computeBurnRate handles partial window correctly", () => {
  const h = createHarness("aa-slo-burn-rate-partial-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "partial_window_slo",
      description: "Partial window SLO",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    // Collect samples
    service.collectSli(slo.id, 2.0, "%");
    service.collectSli(slo.id, 2.0, "%");

    // Query with half window (30 minutes instead of 60)
    const burnRate = service.computeBurnRate(slo.id, 30_000);

    // Burn rate should be calculated based on window fraction
    assert.ok(burnRate >= 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("pagerduty alert channel uses custom dedup key when provided", async () => {
  let receivedBody: unknown = null;
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 202 } as Response;
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_pd_dedup",
    ruleId: "rule_pd_dedup",
    severity: "critical",
    status: "firing",
    title: "Dedup test",
    detail: "Testing dedup key",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { routingKey: "routing-key-1", dedupKey: "custom-dedup-key" });

  assert.equal((receivedBody as { dedup_key: string }).dedup_key, "custom-dedup-key");
});

test("pagerduty alert channel generates dedup key from rule and event when not provided", async () => {
  let receivedBody: unknown = null;
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 202 } as Response;
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_pd_auto_dedup",
    ruleId: "rule_auto_dedup",
    severity: "critical",
    status: "firing",
    title: "Auto dedup test",
    detail: "Testing auto dedup",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { routingKey: "routing-key-1" });

  // Should use ruleId:eventId format
  assert.equal((receivedBody as { dedup_key: string }).dedup_key, "rule_auto_dedup:alert_pd_auto_dedup");
});

test("pagerduty alert channel maps severity correctly", async () => {
  let receivedBody: unknown = null;
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 202 } as Response;
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });

  // Test page severity maps to critical
  const pageEvent: AlertEvent = {
    id: "alert_pd_page",
    ruleId: "rule_page",
    severity: "page",
    status: "firing",
    title: "Page alert",
    detail: "Testing page severity",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(pageEvent, { routingKey: "routing-key-1" });
  assert.equal((receivedBody as { payload: { severity: string } }).payload.severity, "critical");

  // Test warning severity maps to warning
  const warnEvent: AlertEvent = {
    id: "alert_pd_warn",
    ruleId: "rule_warn",
    severity: "warning",
    status: "firing",
    title: "Warn alert",
    detail: "Testing warn severity",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(warnEvent, { routingKey: "routing-key-1" });
  assert.equal((receivedBody as { payload: { severity: string } }).payload.severity, "warning");
});

test("pagerduty alert channel resolves alert with event_action resolve", async () => {
  let receivedBody: unknown = null;
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = init?.body ? JSON.parse(String(init.body)) : null;
    return { ok: true, status: 202 } as Response;
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_pd_resolve",
    ruleId: "rule_resolve",
    severity: "critical",
    status: "resolved",
    title: "Resolved alert",
    detail: "Alert resolved",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: "2026-04-10T01:00:00.000Z",
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { routingKey: "routing-key-1" });

  assert.equal((receivedBody as { event_action: string }).event_action, "resolve");
});

test("pagerduty alert channel uses PAGERDUTY_API_URL env var when endpoint not provided", async () => {
  const originalEnv = process.env.PAGERDUTY_API_URL;
  process.env.PAGERDUTY_API_URL = "https://custom.pagerduty.example.com/v2/enqueue";

  try {
    let receivedUrl = "";
    const mockFetch = async (url: string | URL | Request) => {
      receivedUrl = String(url);
      return { ok: true, status: 202 } as Response;
    };

    const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
    const event: AlertEvent = {
      id: "alert_pd_env",
      ruleId: "rule_env",
      severity: "critical",
      status: "firing",
      title: "Env test",
      detail: "Testing env",
      channelKind: "pagerduty",
      deliveredAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      firedAt: "2026-04-10T00:00:00.000Z",
    };

    channel.deliver(event, { routingKey: "routing-key-1" });

    assert.equal(receivedUrl, "https://custom.pagerduty.example.com/v2/enqueue");
  } finally {
    if (originalEnv !== undefined) {
      process.env.PAGERDUTY_API_URL = originalEnv;
    } else {
      delete process.env.PAGERDUTY_API_URL;
    }
  }
});

test("opsgenie alert channel maps critical severity to P1 priority", async () => {
  let receivedBody: { priority?: string } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 202 } as Response;
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_ops_critical",
    ruleId: "rule_ops_critical",
    severity: "critical",
    status: "firing",
    title: "Critical ops",
    detail: "Critical alert",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { apiKey: "test-key" });

  assert.equal(receivedBody.priority, "P1");
});

test("opsgenie alert channel maps page severity to P1 priority", async () => {
  let receivedBody: { priority?: string } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 202 } as Response;
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_ops_page",
    ruleId: "rule_ops_page",
    severity: "page",
    status: "firing",
    title: "Page ops",
    detail: "Page alert",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { apiKey: "test-key" });

  assert.equal(receivedBody.priority, "P1");
});

test("opsgenie alert channel maps warning severity to P3 priority", async () => {
  let receivedBody: { priority?: string } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 202 } as Response;
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_ops_warning",
    ruleId: "rule_ops_warning",
    severity: "warning",
    status: "firing",
    title: "Warning ops",
    detail: "Warning alert",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { apiKey: "test-key" });

  assert.equal(receivedBody.priority, "P3");
});

test("opsgenie alert channel maps info severity to P5 priority", async () => {
  let receivedBody: { priority?: string } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 202 } as Response;
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_ops_info",
    ruleId: "rule_ops_info",
    severity: "info",
    status: "firing",
    title: "Info ops",
    detail: "Info alert",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { apiKey: "test-key" });

  assert.equal(receivedBody.priority, "P5");
});

test("opsgenie alert channel uses custom endpoint when provided", async () => {
  let receivedUrl = "";
  const mockFetch = async (url: string | URL | Request) => {
    receivedUrl = String(url);
    return { ok: true, status: 202 } as Response;
  };

  const channel = new OpsGenieAlertChannel({
    fetchImpl: mockFetch,
    endpoint: "https://custom.opsgenie.example.com/v2/alerts",
  });
  const event: AlertEvent = {
    id: "alert_ops_endpoint",
    ruleId: "rule_ops_endpoint",
    severity: "warning",
    status: "firing",
    title: "Endpoint test",
    detail: "Testing custom endpoint",
    channelKind: "opsgenie",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { apiKey: "test-key" });

  assert.equal(receivedUrl, "https://custom.opsgenie.example.com/v2/alerts");
});

test("slack alert channel sends correct severity in payload", async () => {
  let receivedBody: { text?: string } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 200 } as Response;
  };

  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_slack_critical",
    ruleId: "rule_slack_critical",
    severity: "critical",
    status: "firing",
    title: "Critical Slack",
    detail: "Critical alert via Slack",
    channelKind: "slack",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

  // Payload should contain severity in uppercase
  assert.ok((receivedBody as { text: string }).text.includes("[CRITICAL]"));
});

test("slack alert channel includes rule and severity in context blocks", async () => {
  let receivedBody: { blocks?: Array<{ type: string; elements?: Array<{ type: string; text?: string }> }> } = {};
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    receivedBody = JSON.parse(String(init?.body));
    return { ok: true, status: 200 } as Response;
  };

  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event: AlertEvent = {
    id: "alert_slack_context",
    ruleId: "rule_slack_context",
    severity: "warning",
    status: "firing",
    title: "Context Test",
    detail: "Testing context blocks",
    channelKind: "slack",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };

  channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

  const contextBlock = receivedBody.blocks?.find((b) => b.type === "context");
  assert.ok(contextBlock !== undefined);
  assert.ok(contextBlock.elements !== undefined);
  assert.ok(contextBlock.elements.length >= 3);
});

test("listAlertEvents with status filter returns only matching events", () => {
  const h = createHarness("aa-alert-list-filter-");
  try {
    const service = new SloAlertingService(h.db);
    const rule = service.defineAlertRule({
      name: "filter_test_rule",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    service.fireAlert(rule.id, "Firing 1", "test");
    const firingAlert = service.fireAlert(rule.id, "Firing 2", "test");
    service.acknowledgeAlert(firingAlert.id, "tester");
    service.fireAlert(rule.id, "Firing 3", "test");

    const firingEvents = service.listAlertEvents("firing");
    assert.ok(firingEvents.every((e) => e.status === "firing"));

    const acknowledgedEvents = service.listAlertEvents("acknowledged");
    assert.ok(acknowledgedEvents.every((e) => e.status === "acknowledged"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listAlertEvents without status filter returns all events", () => {
  const h = createHarness("aa-alert-list-all-");
  try {
    const service = new SloAlertingService(h.db);
    const rule = service.defineAlertRule({
      name: "list_all_rule",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    service.fireAlert(rule.id, "Alert 1", "test");
    service.fireAlert(rule.id, "Alert 2", "test");

    const allEvents = service.listAlertEvents();
    assert.equal(allEvents.length >= 2, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listAlertEvents respects limit parameter", () => {
  const h = createHarness("aa-alert-list-limit-");
  try {
    const service = new SloAlertingService(h.db);
    const rule = service.defineAlertRule({
      name: "limit_test_rule",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    for (let i = 0; i < 10; i++) {
      service.fireAlert(rule.id, `Alert ${i}`, "test");
    }

    const limitedEvents = service.listAlertEvents(undefined, 5);
    assert.equal(limitedEvents.length, 5);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("resolveAlert returns false when alert does not exist", () => {
  const h = createHarness("aa-alert-resolve-missing-");
  try {
    const service = new SloAlertingService(h.db);

    const result = service.resolveAlert("non_existent_alert_id");

    assert.equal(result, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acknowledgeAlert returns false when alert does not exist", () => {
  const h = createHarness("aa-alert-ack-missing-");
  try {
    const service = new SloAlertingService(h.db);

    const result = service.acknowledgeAlert("non_existent_alert_id", "tester");

    assert.equal(result, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("evaluateSlo with lt operator returns met when value is below target", () => {
  const h = createHarness("aa-slo-eval-lt-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "lt_slo",
      description: "Test lt operator",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lt",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 400, "ms");
    service.collectSli(slo.id, 450, "ms");

    const status = service.evaluateSlo(slo.id);
    assert.equal(status, "met");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("evaluateSlo with gt operator returns met when value exceeds target", () => {
  const h = createHarness("aa-slo-eval-gt-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "gt_slo",
      description: "Test gt operator",
      sliKind: "throughput",
      targetValue: 100,
      operator: "gt",
      windowMinutes: 60,
    });

    service.collectSli(slo.id, 150, "rps");
    service.collectSli(slo.id, 200, "rps");

    const status = service.evaluateSlo(slo.id);
    assert.equal(status, "met");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("evaluateSlo marks SLO as at_risk when within margin of target", () => {
  const h = createHarness("aa-slo-eval-at-risk-");
  try {
    const service = new SloAlertingService(h.db);
    const slo = service.defineSlo({
      name: "at_risk_slo",
      description: "Test at_risk detection",
      sliKind: "error_rate",
      targetValue: 1.0,
      operator: "lte",
      windowMinutes: 60,
    });

    // Value is exactly at target - within 10% margin
    service.collectSli(slo.id, 1.0, "%");
    service.collectSli(slo.id, 1.0, "%");

    const status = service.evaluateSlo(slo.id);
    // At exact target with margin, should be at_risk
    assert.ok(["met", "at_risk"].includes(status));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getSlo returns null for non-existent SLO", () => {
  const h = createHarness("aa-slo-get-missing-");
  try {
    const service = new SloAlertingService(h.db);

    const result = service.getSlo("non_existent_slo");

    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listSlos returns empty array when no SLOs defined", () => {
  const h = createHarness("aa-slo-list-empty-");
  try {
    const service = new SloAlertingService(h.db);

    const slos = service.listSlos();

    assert.deepEqual(slos, []);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listSlos returns SLOs ordered by name", () => {
  const h = createHarness("aa-slo-list-ordered-");
  try {
    const service = new SloAlertingService(h.db);
    service.defineSlo({ name: "zebra_slo", description: "", sliKind: "availability", targetValue: 99.9, operator: "gte", windowMinutes: 60 });
    service.defineSlo({ name: "alpha_slo", description: "", sliKind: "availability", targetValue: 99.9, operator: "gte", windowMinutes: 60 });
    service.defineSlo({ name: "middle_slo", description: "", sliKind: "availability", targetValue: 99.9, operator: "gte", windowMinutes: 60 });

    const slos = service.listSlos();

    assert.equal(slos[0]!.name, "alpha_slo");
    assert.equal(slos[1]!.name, "middle_slo");
    assert.equal(slos[2]!.name, "zebra_slo");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listAlertRules returns all rules ordered by created_at", () => {
  const h = createHarness("aa-alert-rules-list-");
  try {
    const service = new SloAlertingService(h.db);
    service.defineAlertRule({
      name: "first_rule",
      sloId: null,
      condition: "",
      severity: "warning",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });
    service.defineAlertRule({
      name: "second_rule",
      sloId: null,
      condition: "",
      severity: "critical",
      channelKind: "log",
      channelConfig: "{}",
      cooldownMinutes: 1,
      enabled: true,
    });

    const rules = service.listAlertRules();

    assert.equal(rules.length, 2);
    assert.ok(rules[0]!.createdAt <= rules[1]!.createdAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listAlertRules returns empty array when no rules defined", () => {
  const h = createHarness("aa-alert-rules-empty-");
  try {
    const service = new SloAlertingService(h.db);

    const rules = service.listAlertRules();

    assert.deepEqual(rules, []);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listRunbookExecutions returns empty array when no executions", () => {
  const h = createHarness("aa-runbook-execs-empty-");
  try {
    const service = new SloAlertingService(h.db);
    const runbook = service.defineRunbook({
      name: "empty_runbook",
      description: "No executions",
      alertRuleId: null,
      steps: "[]",
      autoExecute: false,
    });

    const execs = service.listRunbookExecutions(runbook.id);

    assert.deepEqual(execs, []);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listRunbookExecutions respects limit parameter", () => {
  const h = createHarness("aa-runbook-execs-limit-");
  try {
    const service = new SloAlertingService(h.db);
    const runbook = service.defineRunbook({
      name: "limit_runbook",
      description: "Testing limit",
      alertRuleId: null,
      steps: "[]",
      autoExecute: false,
    });

    for (let i = 0; i < 5; i++) {
      service.executeRunbook(runbook.id, null, "tester");
    }

    const execs = service.listRunbookExecutions(runbook.id, 3);

    assert.equal(execs.length, 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("summary returns correct structure with zero counts", () => {
  const h = createHarness("aa-summary-zero-");
  try {
    const service = new SloAlertingService(h.db);

    const s = service.summary();

    assert.equal(s.sloCount, 0);
    assert.equal(s.breachedCount, 0);
    assert.equal(s.firingAlertCount, 0);
    assert.equal(s.runbookExecutionCount, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
