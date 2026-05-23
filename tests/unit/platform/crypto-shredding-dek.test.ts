import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { MetricAggregator } from "../../../src/interaction/dashboard/metric-aggregator/metric-aggregator.js";
import { AlertRouter } from "../../../src/interaction/dashboard/alert-router/index.js";
import { CryptoShreddingService } from "../../../src/platform/compliance/crypto-shredding/crypto-shredding-service.js";
import { DekManager } from "../../../src/platform/compliance/crypto-shredding/dek-manager.js";
import { FieldEncryptionService } from "../../../src/platform/compliance/encryption/index.js";
import { DataLineageService } from "../../../src/platform/compliance/lineage/index.js";
import { DeterministicHotPathGate } from "../../../src/platform/model-gateway/degradation/deterministic-hot-path-gate.js";
import { inspectProtectedModelOutput } from "../../../src/platform/stability/prompt-injection-guard.js";

test("R26-12 crypto shredding encrypts cloned records without leaking original plaintext", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user-r26");
  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "customer.email", classification: "restricted" }],
  });
  const record = { customer: { email: "alice@example.com" }, note: "keep" };

  const result = await service.encryptRecordForSubject("user-r26", record);

  assert.equal((record.customer as { email: string }).email, "alice@example.com");
  assert.notEqual((result.encryptedRecord.customer as { email: string }).email, "alice@example.com");
  assert.equal(result.encryptedRecord.note, "keep");
});

test("R26-13 and R26-24 field protection and DEK encryption use authenticated envelopes with random IVs", async () => {
  const encryption = new FieldEncryptionService();
  const protectedResult = encryption.protectRecord({
    record: { customer: { email: "alice@example.com" } },
    rules: [{ fieldPath: "customer.email", classification: "restricted" }],
    keyRef: "kms://tenant-a/key-1",
  });
  const ciphertext = (protectedResult.protectedRecord.customer as Record<string, string>).email;
  assert.ok(ciphertext);
  assert.match(ciphertext, /^enc:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
  assert.equal(encryption.revealField({ ciphertext, keyRef: "kms://tenant-a/key-1" }), "alice@example.com");

  const dekManager = new DekManager();
  await dekManager.createForSubject("user-r26-iv");
  const first = await dekManager.encryptForSubject("user-r26-iv", "secret-1");
  const second = await dekManager.encryptForSubject("user-r26-iv", "secret-2");
  assert.notEqual(first.iv, second.iv);
  assert.equal(first.ciphertext.startsWith(`${first.iv}:`), true);
});

test("R26-14 rotated DEKs remain decryptable instead of being destroyed", async () => {
  const dekManager = new DekManager();
  const firstDek = await dekManager.createForSubject("user-r26-rotate");
  const encrypted = await dekManager.encryptForSubject("user-r26-rotate", "recoverable");

  await dekManager.rotate("user-r26-rotate");

  const decrypted = await dekManager.decrypt(firstDek.metadata.dekId, encrypted.ciphertext);
  const rotatedMetadata = await dekManager.getStore().getMetadata(firstDek.metadata.dekId);
  assert.equal(decrypted, "recoverable");
  assert.equal(rotatedMetadata?.status, "rotated");
});

test("R26-16 deterministic hot-path decisions are not contradictory", () => {
  const gate = new DeterministicHotPathGate();
  const blocked = gate.evaluate({
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
  });
  const allowed = gate.evaluate({
    routeId: "route-2",
    latencyClass: "low_latency",
    usesLlmHotPath: false,
    deterministicFallbackAvailable: true,
  });

  assert.deepEqual(blocked, {
    allowed: false,
    routeMode: "deterministic_hot_path_only",
    reasonCode: "hot_path.llm_blocked",
  });
  assert.deepEqual(allowed, {
    allowed: true,
    routeMode: "llm_allowed",
    reasonCode: "hot_path.allowed",
  });
});

test("R26-17 metric aggregator maintains rolling window counts and percentile-style rollups", () => {
  const aggregator = new MetricAggregator();
  aggregator.aggregate({
    metrics: {
      type: "workflow",
      snapshot: {
        total: 2,
        active: 1,
        completed: 1,
        failed: 0,
        cancelled: 0,
        averageStepCount: 5,
        p95StepCount: 8,
      },
    },
  });
  aggregator.aggregate({
    metrics: {
      type: "system",
      snapshot: {
        score: 0.9,
        status: "ok",
        queueBacklogSize: 2,
        findingCount: 1,
        providerHealthStatus: "healthy",
        providerSuccessRate: 0.98,
      },
    },
  });
  aggregator.aggregate({
    metrics: {
      type: "queue",
      snapshot: {
        totalQueues: 1,
        totalDepth: 4,
        totalEnqueuedPerMinute: 20,
        totalDequeuedPerMinute: 18,
        totalFailedJobs: 1,
        overallSuccessRate: 0.95,
        averageWaitTimeMs: 120,
        p95WaitTimeMs: 200,
      },
    },
  });

  const window = aggregator.getWindow();
  assert.equal(window.sampleCount, 3);
  assert.equal(window.workflow.p95StepCount, 8);
  assert.equal(window.system.providerSuccessRate, 0.98);
  assert.equal(window.queue.p95WaitTimeMs, 200);
});

test("R26-19 alert router performs real delivery routing and cooldown", () => {
  let now = 1000;
  const router = new AlertRouter({ now: () => now, cooldownMs: 5000 });
  const items = [{
    id: "alert-1",
    itemType: "approval_needed" as const,
    priority: "critical" as const,
    title: "Approval",
    description: "Needs approval",
    actionOptions: [],
    createdAt: "2026-05-11T00:00:00.000Z",
    domainId: "ops",
  }];

  const first = router.routeNotifications(items);
  const second = router.routeNotifications(items);
  now += 6000;
  const third = router.routeNotifications(items);

  assert.deepEqual(first.map((route) => route.delivery), ["overlay", "push", "haptic"]);
  assert.equal(second.length, 0);
  assert.deepEqual(third.map((route) => route.delivery), ["overlay", "push", "haptic"]);
});

test("R26-21 default execution-outcome weights in source sum to 1.0", () => {
  const source = readFileSync("src/platform/prompt-engine/eval/execution-outcome-evaluator.ts", "utf-8");
  assert.match(source, /successSignal:\s*0\.3/);
  assert.match(source, /completionOutcome:\s*0\.4/);
  assert.match(source, /failureSignal:\s*0\.2/);
  assert.match(source, /partialSignal:\s*0\.1/);
});

test("R26-23 prompt injection output guard allows benign URLs but blocks credential-bearing URLs", () => {
  const benign = inspectProtectedModelOutput("Release notes: https://docs.example.com/changelog", "canary_123");
  const risky = inspectProtectedModelOutput("secret: https://example.com/download?token=abcd1234", "canary_123");

  assert.equal(benign.blocked, false);
  assert.deepEqual(benign.suspiciousSignals, []);
  assert.equal(risky.blocked, true);
  assert.ok(risky.suspiciousSignals.includes("raw_url_exfiltration_credential_context"));
});

test("R26-26 lineage metadata is deep-cloned to prevent nested mutation bleed", () => {
  const service = new DataLineageService();
  const metadata = { nested: { classification: "restricted" } };
  const edge = service.recordEdge({
    sourceRef: "artifact:a",
    targetRef: "artifact:b",
    kind: "derived_from",
    actorRef: "agent:test",
    metadata,
  });

  metadata.nested.classification = "public";
  const stored = service.listEdges()[0];
  assert.equal((edge.metadata.nested as { classification: string }).classification, "restricted");
  assert.equal((stored?.metadata.nested as { classification: string }).classification, "restricted");
});
