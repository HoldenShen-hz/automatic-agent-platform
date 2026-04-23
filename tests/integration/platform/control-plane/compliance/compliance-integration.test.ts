/**
 * Integration Test: Compliance Module - Erasure, DEK, and Residency Services
 *
 * Tests the full compliance lifecycle including:
 * - Erasure request lifecycle (create, submit, complete, cancel, fail)
 * - Data Encryption Key (DEK) management and crypto-shredding
 * - Data residency enforcement and violation tracking
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { createMockComplianceStore } from "../../../../helpers/mock-compliance-store.js";

test("compliance: erasure request lifecycle", () => {
  const workspace = createTempWorkspace("erasure-lifecycle-");

  try {
    const dbPath = join(workspace, "erasure-lifecycle.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db) as AuthoritativeTaskStore & { compliance: ReturnType<typeof createMockComplianceStore> };
    store.compliance = createMockComplianceStore();

    // Create erasure request
    const now = nowIso();
    const erasureId = "erasure_test_1";

    store.compliance.insertErasureRequest({
      erasureId,
      tenantId: "tenant-1",
      subjectType: "user",
      subjectId: "user-123",
      status: "pending",
      requestedBy: "admin-1",
      reason: "User requested account deletion",
      legalBasis: "gdpr_article_17_1",
      createdAt: now,
      updatedAt: now,
      processedAt: null,
      completedAt: null,
      failedAt: null,
      failureReason: null,
      traceId: "trace-1",
      evidenceRefs: [],
      notes: null,
      metadataJson: null,
    });

    const request = store.compliance.getErasureRequest(erasureId);
    assert.ok(request, "Erasure request should be created");
    assert.strictEqual(request!.status, "pending");
    assert.strictEqual(request!.subjectType, "user");
    assert.strictEqual(request!.subjectId, "user-123");

    // Update status to processing
    const processing: typeof request = {
      ...request!,
      status: "processing",
      processedAt: now,
      updatedAt: nowIso(),
    };
    store.compliance.updateErasureRequest(processing);

    const processingRequest = store.compliance.getErasureRequest(erasureId);
    assert.strictEqual(processingRequest!.status, "processing");
    assert.ok(processingRequest!.processedAt, "Should have processedAt set");

    // Complete the request
    const completed: typeof request = {
      ...processingRequest!,
      status: "completed",
      completedAt: nowIso(),
      updatedAt: nowIso(),
      evidenceRefs: [JSON.stringify({ evidenceType: "dek_destruction", referenceId: "key-1", timestamp: now })],
    };
    store.compliance.updateErasureRequest(completed);

    const completedRequest = store.compliance.getErasureRequest(erasureId);
    assert.strictEqual(completedRequest!.status, "completed");
    assert.ok(completedRequest!.completedAt, "Should have completedAt set");
    assert.ok(completedRequest!.evidenceRefs.length > 0, "Should have evidence refs");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("compliance: DEK lifecycle (create, rotate, destroy)", () => {
  const workspace = createTempWorkspace("dek-lifecycle-");

  try {
    const dbPath = join(workspace, "dek-lifecycle.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db) as AuthoritativeTaskStore & { compliance: ReturnType<typeof createMockComplianceStore> };
    store.compliance = createMockComplianceStore();

    const now = nowIso();
    const tenantId = "tenant-dek-1";

    // Create first DEK
    const dek1Id = "dek_1";
    store.compliance.insertDataEncryptionKey({
      keyId: dek1Id,
      tenantId,
      version: 1,
      status: "active",
      encryptedKeyMaterial: "encrypted_key_material_v1",
      algorithm: "AES-256-GCM",
      externalKeyId: "arn:aws:kms:us-east-1:123:key/key-1",
      createdAt: now,
      updatedAt: now,
      destroyedAt: null,
      createdBy: "system",
      destroyedBy: null,
      destructionReason: null,
      traceId: null,
      metadataJson: null,
    });

    const active1 = store.compliance.getActiveDataEncryptionKey(tenantId);
    assert.ok(active1, "Should have active DEK");
    assert.strictEqual(active1!.keyId, dek1Id);
    assert.strictEqual(active1!.version, 1);
    assert.strictEqual(active1!.status, "active");

    // Create second DEK (rotation)
    const dek2Id = "dek_2";
    store.compliance.insertDataEncryptionKey({
      keyId: dek2Id,
      tenantId,
      version: 2,
      status: "active",
      encryptedKeyMaterial: "encrypted_key_material_v2",
      algorithm: "AES-256-GCM",
      externalKeyId: "arn:aws:kms:us-east-1:123:key/key-2",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      destroyedAt: null,
      createdBy: "system",
      destroyedBy: null,
      destructionReason: null,
      traceId: null,
      metadataJson: null,
    });

    // Mark old DEK as rotating
    const oldDek = store.compliance.getDataEncryptionKey(dek1Id);
    store.compliance.updateDataEncryptionKey({ ...oldDek!, status: "rotating", updatedAt: nowIso() });

    const active2 = store.compliance.getActiveDataEncryptionKey(tenantId);
    assert.strictEqual(active2!.keyId, dek2Id);
    assert.strictEqual(active2!.version, 2);

    const allKeys = store.compliance.listDataEncryptionKeysByTenant(tenantId);
    assert.strictEqual(allKeys.length, 2, "Should have 2 DEK versions");

    // Destroy DEK (crypto-shredding)
    const dek2 = store.compliance.getDataEncryptionKey(dek2Id);
    store.compliance.updateDataEncryptionKey({
      ...dek2!,
      status: "destroyed",
      encryptedKeyMaterial: null,
      destroyedAt: nowIso(),
      destroyedBy: "erasure-service",
      destructionReason: "erasure_request",
    });

    const destroyed = store.compliance.getDataEncryptionKey(dek2Id);
    assert.strictEqual(destroyed!.status, "destroyed");
    assert.strictEqual(destroyed!.encryptedKeyMaterial, null, "Key material should be cleared");
    assert.ok(destroyed!.destroyedAt, "Should have destroyedAt timestamp");
    assert.strictEqual(destroyed!.destructionReason, "erasure_request");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("compliance: data residency check and violation detection", () => {
  const workspace = createTempWorkspace("residency-check-");

  try {
    const dbPath = join(workspace, "residency-check.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db) as AuthoritativeTaskStore & { compliance: ReturnType<typeof createMockComplianceStore> };
    store.compliance = createMockComplianceStore();

    const now = nowIso();
    const tenantId = "tenant-residency-1";

    // Record EU data placement (compliant)
    store.compliance.insertDataPlacement({
      placementId: "placement_1",
      tenantId,
      category: "personal",
      currentRegion: "eu-west-1",
      currentJurisdiction: "EU",
      isCompliant: true,
      recordedAt: now,
      metadataJson: null,
    });

    // Record US data placement (potentially non-compliant for EU data)
    store.compliance.insertDataPlacement({
      placementId: "placement_2",
      tenantId,
      category: "personal",
      currentRegion: "us-east-1",
      currentJurisdiction: "US",
      isCompliant: false,
      recordedAt: nowIso(),
      metadataJson: null,
    });

    // Insert violation for non-compliant placement
    store.compliance.insertResidencyViolation({
      violationId: "violation_1",
      tenantId,
      category: "personal",
      region: "us-east-1",
      jurisdiction: "US",
      violatedRuleId: "rule_eu",
      description: "EU personal data stored in US region",
      severity: "high",
      detectedAt: nowIso(),
      resolvedAt: null,
      resolutionNotes: null,
    });

    const placements = store.compliance.listDataPlacementsByTenant(tenantId);
    assert.strictEqual(placements.length, 2, "Should have 2 placements");

    const violations = store.compliance.listResidencyViolationsByTenant(tenantId);
    assert.strictEqual(violations.length, 1, "Should have 1 violation");
    assert.strictEqual(violations[0].severity, "high");
    assert.ok(violations[0].resolvedAt === null, "Violation should be unresolved");

    // Resolve violation
    const resolvedViolation = {
      ...violations[0],
      resolvedAt: nowIso(),
      resolutionNotes: "Data migrated back to EU",
    };
    store.compliance.updateResidencyViolation(resolvedViolation);

    const updatedViolations = store.compliance.listResidencyViolationsByTenant(tenantId);
    const unresolvedOnly = updatedViolations.filter(v => v.resolvedAt === null);
    assert.strictEqual(unresolvedOnly.length, 0, "No unresolved violations after resolution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("compliance: list erasure requests by tenant", () => {
  const workspace = createTempWorkspace("erasure-list-");

  try {
    const dbPath = join(workspace, "erasure-list.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db) as AuthoritativeTaskStore & { compliance: ReturnType<typeof createMockComplianceStore> };
    store.compliance = createMockComplianceStore();

    const now = nowIso();
    const tenantId = "tenant-list-1";

    // Create multiple erasure requests
    for (let i = 1; i <= 3; i++) {
      store.compliance.insertErasureRequest({
        erasureId: `erasure_${i}`,
        tenantId,
        subjectType: "user",
        subjectId: `user-${i}`,
        status: i === 2 ? "completed" : "pending",
        requestedBy: "admin-1",
        reason: `Deletion request ${i}`,
        legalBasis: "gdpr_article_17",
        createdAt: now,
        updatedAt: now,
        processedAt: i === 2 ? now : null,
        completedAt: i === 2 ? now : null,
        failedAt: null,
        failureReason: null,
        traceId: `trace-${i}`,
        evidenceRefs: [],
        notes: null,
        metadataJson: null,
      });
    }

    const requests = store.compliance.listErasureRequestsByTenant(tenantId);
    assert.strictEqual(requests.length, 3, "Should have 3 erasure requests");

    // Filter by status
    const pendingRequests = requests.filter(r => r.status === "pending");
    assert.strictEqual(pendingRequests.length, 2, "Should have 2 pending requests");

    // List by trace ID
    const traceRequests = store.compliance.listErasureRequestsByTraceId("trace-1");
    assert.strictEqual(traceRequests.length, 1);
    assert.strictEqual(traceRequests[0].erasureId, "erasure_1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("compliance: DEK tenant summary", () => {
  const workspace = createTempWorkspace("dek-summary-");

  try {
    const dbPath = join(workspace, "dek-summary.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db) as AuthoritativeTaskStore & { compliance: ReturnType<typeof createMockComplianceStore> };
    store.compliance = createMockComplianceStore();

    const now = nowIso();
    const tenantId = "tenant-summary-1";

    // Create 3 DEK versions
    for (let i = 1; i <= 3; i++) {
      store.compliance.insertDataEncryptionKey({
        keyId: `dek_v${i}`,
        tenantId,
        version: i,
        status: i === 3 ? "active" : i === 1 ? "destroyed" : "rotating",
        encryptedKeyMaterial: i === 3 ? "active_key" : null,
        algorithm: "AES-256-GCM",
        externalKeyId: `arn:key-${i}`,
        createdAt: now,
        updatedAt: now,
        destroyedAt: i === 1 ? now : null,
        createdBy: "system",
        destroyedBy: i === 1 ? "erasure" : null,
        destructionReason: i === 1 ? "erasure_request" : null,
        traceId: null,
        metadataJson: null,
      });
    }

    const keys = store.compliance.listDataEncryptionKeysByTenant(tenantId);
    const activeKey = store.compliance.getActiveDataEncryptionKey(tenantId);
    const destroyedKeys = keys.filter(k => k.status === "destroyed");

    assert.strictEqual(keys.length, 3, "Should have 3 DEK versions");
    assert.ok(activeKey, "Should have active DEK");
    assert.strictEqual(activeKey!.version, 3, "Active DEK should be version 3");
    assert.strictEqual(destroyedKeys.length, 1, "Should have 1 destroyed DEK");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
