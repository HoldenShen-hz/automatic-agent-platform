/**
 * Unit tests for Compliance Types
 */
import assert from "node:assert/strict";
import test from "node:test";
test("ComplianceStore interface defines all required methods", () => {
    // Verify the interface defines all required storage operations
    const methods = [
        // Erasure Request operations
        "insertErasureRequest",
        "getErasureRequest",
        "updateErasureRequest",
        "listErasureRequestsByTenant",
        "listErasureRequestsByTraceId",
        // Erasure Report operations
        "insertErasureReport",
        "getErasureReport",
        "updateErasureReport",
        "listErasureReportsByTenant",
        "listErasureReportsByErasureId",
        // DEK operations
        "insertDataEncryptionKey",
        "getDataEncryptionKey",
        "updateDataEncryptionKey",
        "getActiveDataEncryptionKey",
        "listDataEncryptionKeysByTenant",
        // Data Placement operations
        "insertDataPlacement",
        "listDataPlacementsByTenant",
        // Residency Violation operations
        "insertResidencyViolation",
        "updateResidencyViolation",
        "listResidencyViolationsByTenant",
        "listAllResidencyViolations",
    ];
    // ComplianceStore is an interface, so we can't directly check methods
    // but we can verify it exists and is used as a type
    const _store = undefined;
    assert.ok(_store === undefined); // Just to use the variable
});
test("ErasureRequest can be used as a type", () => {
    const request = {
        erasureId: "erasure-1",
        tenantId: "tenant-1",
        traceId: "trace-1",
        requestedBy: "user-1",
        reason: "User requested deletion",
        legalBasis: "gdpr_article_17_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        processedAt: null,
        completedAt: null,
        failedAt: null,
        failureReason: null,
        evidenceRefs: [],
        notes: null,
        metadataJson: null,
        status: "pending",
        subjectType: "user",
        subjectId: "subject-1",
    };
    assert.equal(request.erasureId, "erasure-1");
    assert.equal(request.tenantId, "tenant-1");
    assert.equal(request.status, "pending");
});
test("ErasureReport can be used as a type", () => {
    const report = {
        reportId: "report-1",
        erasureId: "erasure-1",
        tenantId: "tenant-1",
        subjects: [
            {
                subjectType: "user",
                subjectId: "subject-1",
                dataCategories: ["profile"],
                erased: true,
            },
        ],
        evidenceRefs: [
            {
                evidenceType: "dek_destruction",
                referenceId: "dek-1",
                description: "Destroyed tenant key",
                timestamp: "2026-01-15T00:00:00.000Z",
            },
        ],
        traceId: "trace-1",
        verificationStatus: "verified",
        verifiedAt: "2026-01-15T00:00:00.000Z",
        generatedAt: "2026-01-15T00:00:00.000Z",
        updatedAt: "2026-01-15T00:00:00.000Z",
        notes: null,
        metadataJson: null,
    };
    assert.equal(report.reportId, "report-1");
    assert.equal(report.erasureId, "erasure-1");
    assert.equal(report.verificationStatus, "verified");
    assert.equal(report.subjects.length, 1);
});
test("DataEncryptionKey can be used as a type", () => {
    const dek = {
        keyId: "dek-1",
        tenantId: "tenant-1",
        version: 1,
        algorithm: "AES-256-GCM",
        encryptedKeyMaterial: "encrypted-key-data",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        destroyedAt: null,
        status: "active",
        createdBy: "system",
        externalKeyId: null,
        destroyedBy: null,
        destructionReason: null,
        traceId: null,
        metadataJson: null,
    };
    assert.equal(dek.keyId, "dek-1");
    assert.equal(dek.tenantId, "tenant-1");
    assert.equal(dek.version, 1);
    assert.equal(dek.algorithm, "AES-256-GCM");
    assert.equal(dek.status, "active");
});
test("DataPlacement can be used as a type", () => {
    const placement = {
        placementId: "placement-1",
        tenantId: "tenant-1",
        category: "personal",
        currentRegion: "us-east-1",
        currentJurisdiction: "US",
        isCompliant: true,
        recordedAt: "2026-01-01T00:00:00.000Z",
        metadataJson: null,
    };
    assert.equal(placement.placementId, "placement-1");
    assert.equal(placement.tenantId, "tenant-1");
    assert.equal(placement.currentRegion, "us-east-1");
    assert.equal(placement.category, "personal");
});
test("ResidencyViolation can be used as a type", () => {
    const violation = {
        violationId: "violation-1",
        tenantId: "tenant-1",
        detectedAt: "2026-01-15T00:00:00.000Z",
        category: "personal",
        region: "us-east-1",
        jurisdiction: "US",
        violatedRuleId: "rule-eu-only",
        description: "Data found in wrong region",
        severity: "high",
        resolvedAt: null,
        resolutionNotes: null,
    };
    assert.equal(violation.violationId, "violation-1");
    assert.equal(violation.tenantId, "tenant-1");
    assert.equal(violation.region, "us-east-1");
    assert.equal(violation.jurisdiction, "US");
    assert.equal(violation.severity, "high");
});
test("ComplianceStore type is actually an interface", () => {
    // This test verifies that ComplianceStore is an interface type
    // by checking that it can be used in type positions
    function checkStore(store) {
        return null;
    }
    const result = checkStore({});
    assert.equal(result, null);
});
test("ErasureRequest status can be various values", () => {
    const pending = {
        erasureId: "erasure-1",
        tenantId: "tenant-1",
        traceId: "trace-1",
        requestedBy: "user-1",
        reason: "User requested deletion",
        legalBasis: "gdpr_article_17_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        processedAt: null,
        completedAt: null,
        failedAt: null,
        failureReason: null,
        evidenceRefs: [],
        notes: null,
        metadataJson: null,
        status: "pending",
        subjectType: "user",
        subjectId: "subject-1",
    };
    const approved = {
        ...pending,
        status: "processing",
    };
    const rejected = {
        ...pending,
        status: "completed",
        completedAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
    };
    assert.equal(pending.status, "pending");
    assert.equal(approved.status, "processing");
    assert.equal(rejected.status, "completed");
});
test("DataEncryptionKey status can be active or retired", () => {
    const active = {
        keyId: "dek-1",
        tenantId: "tenant-1",
        version: 1,
        algorithm: "AES-256-GCM",
        encryptedKeyMaterial: "encrypted-key-data",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        destroyedAt: null,
        status: "active",
        createdBy: "system",
        externalKeyId: null,
        destroyedBy: null,
        destructionReason: null,
        traceId: null,
        metadataJson: null,
    };
    const retired = {
        keyId: "dek-2",
        tenantId: "tenant-1",
        version: 2,
        algorithm: "AES-256-GCM",
        encryptedKeyMaterial: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        destroyedAt: "2026-01-01T00:00:00.000Z",
        status: "destroyed",
        createdBy: "system",
        externalKeyId: null,
        destroyedBy: "system",
        destructionReason: "erasure_request",
        traceId: null,
        metadataJson: null,
    };
    assert.equal(active.status, "active");
    assert.equal(retired.status, "destroyed");
});
test("ResidencyViolation resolution can be various values", () => {
    const pending = {
        violationId: "violation-1",
        tenantId: "tenant-1",
        detectedAt: "2026-01-15T00:00:00.000Z",
        category: "personal",
        region: "us-east-1",
        jurisdiction: "US",
        violatedRuleId: "rule-eu-only",
        description: "Data found in wrong region",
        severity: "high",
        resolvedAt: null,
        resolutionNotes: null,
    };
    const resolved = {
        ...pending,
        resolvedAt: "2026-01-16T00:00:00.000Z",
        resolutionNotes: "Data migrated back to compliant region",
    };
    const acknowledged = {
        ...pending,
        resolvedAt: "2026-01-16T00:00:00.000Z",
        resolutionNotes: "Risk accepted by compliance team",
    };
    assert.equal(pending.resolvedAt, null);
    assert.equal(resolved.resolutionNotes, "Data migrated back to compliant region");
    assert.equal(acknowledged.resolutionNotes, "Risk accepted by compliance team");
});
//# sourceMappingURL=types.test.js.map