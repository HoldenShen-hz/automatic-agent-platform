import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ConnectorFrameworkService } from "../../src/scale-ecosystem/integration/connector-framework-service.js";
import { PmfValidationService } from "../../src/scale-ecosystem/intelligence/pmf-validation-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
import { PMF_EVALUATED_AT, seedPmfValidationDataset } from "../helpers/pmf.js";

test("E2E: connector framework enforces prod verification, defers degraded connectors, and fail-closes unsupported events", () => {
  const connectors = new ConnectorFrameworkService();

  connectors.register({
    connectorId: "crm-sync-e2e",
    provider: "crm",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["crm.contact.updated"],
    lifecycleState: "verified",
  });
  connectors.register({
    connectorId: "ops-webhook-e2e",
    provider: "webhook",
    capabilities: ["notify"],
    authMode: "api_key",
    rateLimits: { perMinute: 120 },
    supportedEvents: ["ops.incident.opened"],
    lifecycleState: "enabled",
  });
  connectors.register({
    connectorId: "draft-sync-e2e",
    provider: "erp",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 30 },
    supportedEvents: ["erp.invoice.created"],
    lifecycleState: "configured",
  });

  const prodBinding = connectors.bind("crm-sync-e2e", "tenant-integration-e2e", "prod", "2026-04-24T14:00:00.000Z");
  const devBinding = connectors.bind("draft-sync-e2e", "tenant-integration-e2e", "dev", "2026-04-24T14:01:00.000Z");
  connectors.recordHealth({
    connectorId: "crm-sync-e2e",
    status: "degraded",
    latencyMs: 450,
    checkedAt: "2026-04-24T14:02:00.000Z",
  });
  connectors.recordHealth({
    connectorId: "ops-webhook-e2e",
    status: "failed",
    latencyMs: 1200,
    checkedAt: "2026-04-24T14:03:00.000Z",
  });

  let prodVerificationError: unknown = null;
  try {
    connectors.bind("draft-sync-e2e", "tenant-integration-e2e", "prod", "2026-04-24T14:04:00.000Z");
  } catch (error) {
    prodVerificationError = error;
  }

  const degradedRun = connectors.execute({
    connectorId: "crm-sync-e2e",
    capability: "sync",
    payload: { contactId: "contact-1" },
    policyRef: "policy.connector.crm-sync-e2e",
    secretBindings: [{ secretRef: "secret://crm-sync-e2e/token", purpose: "api_token" }],
  }, {
    environment: "prod",
    eventType: "crm.contact.updated",
    executedAt: "2026-04-24T14:05:00.000Z",
  });
  const failedRun = connectors.execute({
    connectorId: "ops-webhook-e2e",
    capability: "notify",
    payload: { incidentId: "incident-1" },
    policyRef: "policy.connector.ops-webhook-e2e",
    secretBindings: [{ secretRef: "secret://ops-webhook-e2e/token", purpose: "webhook_secret" }],
  }, {
    environment: "prod",
    eventType: "ops.incident.opened",
    executedAt: "2026-04-24T14:06:00.000Z",
  });
  const unsupportedEventRun = connectors.execute({
    connectorId: "crm-sync-e2e",
    capability: "sync",
    payload: { contactId: "contact-2" },
    policyRef: "policy.connector.crm-sync-e2e",
    secretBindings: [{ secretRef: "secret://crm-sync-e2e/token", purpose: "api_token" }],
  }, {
    environment: "prod",
    eventType: "crm.contact.deleted",
    executedAt: "2026-04-24T14:07:00.000Z",
  });

  assert.equal(prodBinding.environment, "prod");
  assert.equal(devBinding.environment, "dev");
  assert.equal((prodVerificationError as Error | null)?.message, "connector_framework.prod_requires_verified:draft-sync-e2e");
  assert.equal(degradedRun.status, "deferred");
  assert.equal(failedRun.status, "failed");
  assert.equal(unsupportedEventRun.status, "failed");
  assert.equal(connectors.listBindings({ tenantId: "tenant-integration-e2e" }).length, 2);
  assert.deepEqual(
    connectors.listEnabled().map((manifest) => manifest.connectorId).sort(),
    ["ops-webhook-e2e"],
  );
});

test("E2E: PMF validation exports scoped reports, persists history, and keeps artifact evidence addressable", () => {
  const harness = createE2EHarness("aa-e2e-pmf-flow-");
  const artifactRoot = join(harness.workspace, "artifacts");

  try {
    seedPmfValidationDataset(harness.db, harness.store);
    const pmf = new PmfValidationService(harness.db, harness.store, {
      rootDir: artifactRoot,
    });
    const allDivisions = pmf.buildReport({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "phase3_all_divisions",
    });

    const exported = pmf.exportValidation({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "phase3_e2e",
      divisionId: "general_ops",
    });
    const latest = pmf.getLatest("phase3_e2e");
    const history = pmf.listHistory(10);
    const markdown = readFileSync(exported.markdownArtifact.uri, "utf8");

    assert.equal(exported.report.profileName, "phase3_e2e");
    assert.equal(exported.report.metrics.taskCount, 5);
    assert.equal(exported.report.metrics.sessionCount, 3);
    assert.equal(exported.report.metrics.divisionCount, 1);
    assert.equal(allDivisions.metrics.taskCount, 6);
    assert.equal(allDivisions.metrics.divisionCount, 2);
    assert.equal(latest?.id, exported.report.reportId);
    assert.equal(history.length, 1);
    assert.equal(harness.store.listArtifactsByTask("pmf_validation").length, 2);
    assert.ok(existsSync(exported.jsonArtifact.uri));
    assert.ok(existsSync(exported.markdownArtifact.uri));
    assert.ok(markdown.includes("# PMF Validation Report"));
    assert.ok(markdown.includes("phase3_e2e"));
  } finally {
    harness.cleanup();
  }
});
