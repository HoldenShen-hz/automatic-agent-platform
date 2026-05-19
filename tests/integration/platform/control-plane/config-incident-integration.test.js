import assert from "node:assert/strict";
import test from "node:test";

import { ConfigStore } from "../../../../../src/platform/control-plane/config-center/config-store.js";
import { IncidentDetector } from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

/**
 * Integration test: Config Store + Incident Detector
 *
 * Tests the flow where:
 * 1. Configuration is loaded into the store
 * 2. Incident detector uses config to detect issues
 */
test("config-store and incident-detector integration", (t, done) => {
  // Create and configure store
  const store = new ConfigStore({
    source: "integration-test",
    initialEntries: {
      "detector.maxOpenIncidents": 100,
      "detector.autoEscalateP1AfterSeconds": 300,
      "detector.checkIntervalMs": 60000,
    },
  });

  // Create incident detector using config values
  const maxOpen = store.get<number>("detector.maxOpenIncidents");
  const autoEscalate = store.get<number>("detector.autoEscalateP1AfterSeconds");

  const detector = new IncidentDetector({
    maxOpenIncidents: maxOpen ?? 100,
    autoEscalateP1AfterSeconds: autoEscalate ?? 300,
  });

  // Simulate health check results
  const checks = [
    {
      checkId: "db",
      status: "fail_closed",
      summary: "Database connection pool exhausted",
      findings: ["connection timeout after 30s", "pool size exceeded"],
      metrics: { poolAvailable: 0, poolSize: 50, waitTimeMs: 30000 },
    },
    {
      checkId: "event_backlog",
      status: "degraded",
      summary: "Event processing backlog growing",
      findings: ["backlog size: 10000", "processing rate: 100/s"],
      metrics: { backlogSize: 10000, processingRate: 100 },
    },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 2);
  assert.equal(incidents[0]!.severity, "p1");
  assert.equal(incidents[0]!.category, "data_integrity");
  assert.equal(incidents[1]!.severity, "p2");
  assert.equal(incidents[1]!.category, "performance");

  // Verify detector configuration from store
  assert.equal(detector["maxOpenIncidents"], 100);
  assert.equal(detector["autoEscalateP1AfterSeconds"], 300);

  done();
});

test("config-store snapshot and restore preserves detector settings", (t, done) => {
  const store = new ConfigStore({
    initialEntries: {
      "detector.maxOpenIncidents": 50,
      "detector.autoEscalateP1AfterSeconds": 600,
    },
  });

  // Snapshot before changes
  const snapshot = store.snapshot();

  // Update configuration
  store.set("detector.maxOpenIncidents", 200);
  store.set("detector.autoEscalateP1AfterSeconds", 120);

  // Restore from snapshot
  store.restore(snapshot);

  assert.equal(store.get("detector.maxOpenIncidents"), 50);
  assert.equal(store.get("detector.autoEscalateP1AfterSeconds"), 600);

  done();
});

test("config-store change listener tracks incident detector updates", (t, done) => {
  const store = new ConfigStore();
  const changes: Array<{ key: string; old: unknown; new: unknown }> = [];

  store.onChange((key, oldVal, newVal) => {
    changes.push({ key, old: oldVal, new: newVal });
  });

  // Simulate configuration updates
  store.set("incident.p1.escalationSeconds", 300);
  store.set("incident.p2.escalationSeconds", 900);
  store.set("incident.p1.escalationSeconds", 600); // Update

  assert.equal(changes.length, 3);
  assert.equal(changes[0]!.key, "incident.p1.escalationSeconds");
  assert.equal(changes[0]!.new, 300);
  assert.equal(changes[2]!.key, "incident.p1.escalationSeconds");
  assert.equal(changes[2]!.new, 600);

  done();
});

test("incident-detector creates incidents with source from config", (t, done) => {
  const store = new ConfigStore({
    initialEntries: {
      "source.prefix": "integration-test",
      "source.environment": "staging",
    },
  });

  const prefix = store.get<string>("source.prefix") ?? "default";
  const environment = store.get<string>("source.environment") ?? "unknown";

  const detector = new IncidentDetector();

  // Create incident with configured source info
  const incident = detector.createIncident({
    category: "availability",
    severity: "p2",
    title: `${prefix}: Service degradation in ${environment}`,
    description: "High latency detected in production services",
    sourceCheckId: "workers",
    symptoms: ["slow_response", "timeout_errors"],
    affectedEntities: [`${environment}-api-gateway-1`],
  });

  assert.ok(incident.title.includes("integration-test"));
  assert.ok(incident.title.includes("staging"));
  assert.equal(incident.sourceCheckId, "workers");

  done();
});

test("config-store handles detector check mapping", (t, done) => {
  const store = new ConfigStore({
    initialEntries: {
      "check.category.db": "data_integrity",
      "check.category.config": "configuration",
      "check.category.backup": "availability",
      "check.category.workers": "availability",
      "check.category.audit_integrity": "security",
    },
  });

  // Verify check-to-category mapping stored in config
  assert.equal(store.get("check.category.db"), "data_integrity");
  assert.equal(store.get("check.category.backup"), "availability");
  assert.equal(store.get("check.category.audit_integrity"), "security");

  done();
});

test("config-store merge combines multiple sources", (t, done) => {
  const store = new ConfigStore({
    initialEntries: {
      "detector.base.maxOpenIncidents": 100,
      "detector.base.autoEscalateP1AfterSeconds": 300,
    },
  });

  // Merge environment-specific overrides
  store.merge({
    "detector.env.maxOpenIncidents": 200,
    "detector.env.autoEscalateP1AfterSeconds": 600,
    "detector.env.checkIntervalMs": 30000,
  });

  // Both base and env configs should be present
  assert.equal(store.get("detector.base.maxOpenIncidents"), 100);
  assert.equal(store.get("detector.env.maxOpenIncidents"), 200);
  assert.equal(store.get("detector.env.checkIntervalMs"), 30000);

  done();
});