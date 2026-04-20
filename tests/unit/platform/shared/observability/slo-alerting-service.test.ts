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
    const service = new SloAlertingService(h.db);
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

    const execs = service.listRunbookExecutions(runbook.id);
    assert.equal(execs.length, 1);
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
