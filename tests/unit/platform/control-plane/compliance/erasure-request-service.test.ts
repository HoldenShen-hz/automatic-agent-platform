import assert from "node:assert/strict";
import test from "node:test";

import { ErasureRequestService } from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-request-service.js";
import type { ErasureRequest } from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-request-service.js";
import type { ComplianceStore } from "../../../../../src/platform/five-plane-control-plane/compliance/types.js";

// Mock store implementation
function createMockStore(): { compliance: ComplianceStore; event: { insertEvent: (event: { id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }) => void }; events: Array<{ id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }> } {
  const erasureRequests = new Map<string, ErasureRequest>();
  const events: Array<{ id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }> = [];

  return {
    compliance: {
      insertErasureRequest: (request: ErasureRequest) => {
        erasureRequests.set(request.erasureId, request);
      },
      getErasureRequest: (erasureId: string): ErasureRequest | null => {
        return erasureRequests.get(erasureId) ?? null;
      },
      updateErasureRequest: (request: ErasureRequest) => {
        erasureRequests.set(request.erasureId, request);
      },
      listErasureRequestsByTenant: (tenantId: string): ErasureRequest[] => {
        return Array.from(erasureRequests.values())
          .filter((r: ErasureRequest) => r.tenantId === tenantId)
          .sort((a: ErasureRequest, b: ErasureRequest) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      },
      listErasureRequestsByTraceId: (traceId: string): ErasureRequest[] => {
        return Array.from(erasureRequests.values()).filter((r: ErasureRequest) => r.traceId === traceId);
      },
      // Placeholder methods not used in these tests
      insertErasureReport: () => { throw new Error("not implemented"); },
      getErasureReport: () => null,
      updateErasureReport: () => { throw new Error("not implemented"); },
      listErasureReportsByTenant: () => [],
      listErasureReportsByErasureId: () => [],
      insertDataEncryptionKey: () => { throw new Error("not implemented"); },
      getDataEncryptionKey: () => null,
      updateDataEncryptionKey: () => { throw new Error("not implemented"); },
      getActiveDataEncryptionKey: () => null,
      listDataEncryptionKeysByTenant: () => [],
      insertDataPlacement: () => { throw new Error("not implemented"); },
      listDataPlacementsByTenant: () => [],
      insertResidencyViolation: () => { throw new Error("not implemented"); },
      updateResidencyViolation: () => { throw new Error("not implemented"); },
      listResidencyViolationsByTenant: () => [],
      listAllResidencyViolations: () => [],
    },
    event: {
      insertEvent: (event: { id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }) => {
        events.push(event);
      },
    },
    events,
  };
}

// Mock db with synchronous transaction
function createMockDb(_mockStore?: unknown) {
  return {
    transaction: (fn: () => void) => fn(),
  };
}

test("ErasureRequestService creates erasure request with pending status", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const request = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin-789",
    reason: "User requested data deletion",
    legalBasis: "gdpr_article_17_1",
  });

  assert.ok(request.erasureId.startsWith("erasure_"), "Should have erasure_ prefix");
  assert.equal(request.status, "pending");
  assert.equal(request.tenantId, "tenant-123");
  assert.equal(request.subjectType, "user");
  assert.equal(request.subjectId, "user-456");
  assert.equal(request.requestedBy, "admin-789");
  assert.equal(request.reason, "User requested data deletion");
  assert.equal(request.legalBasis, "gdpr_article_17_1");
  assert.ok(request.traceId.startsWith("trace_"), "Should have trace_ prefix");
  assert.ok(request.createdAt, "Should have createdAt timestamp");
  assert.deepEqual(request.evidenceRefs, []);
});

test("ErasureRequestService creates request with custom traceId", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const request = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "workspace",
    subjectId: "ws-789",
    requestedBy: "system",
    reason: "Workspace closure",
    traceId: "trace_existing_123",
  });

  assert.equal(request.traceId, "trace_existing_123");
});

test("ErasureRequestService.createRequest throws on invalid tenantId", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.createRequest({
        tenantId: "",
        subjectType: "user",
        subjectId: "user-456",
        requestedBy: "admin",
        reason: "Test",
      }),
    (err: any) => err.code === "erasure.invalid_tenant_id",
  );
});

test("ErasureRequestService.createRequest throws on missing subjectId", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.createRequest({
        tenantId: "tenant-123",
        subjectType: "user",
        subjectId: "",
        requestedBy: "admin",
        reason: "Test",
      }),
    (err: any) => err.code === "erasure.invalid_subject_id",
  );
});

test("ErasureRequestService.createRequest throws on missing reason", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.createRequest({
        tenantId: "tenant-123",
        subjectType: "user",
        subjectId: "user-456",
        requestedBy: "admin",
        reason: "",
      }),
    (err: any) => err.code === "erasure.invalid_reason",
  );
});

test("ErasureRequestService.submitRequest transitions status to processing", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  const submitted = service.submitRequest(created.erasureId);

  assert.equal(submitted.status, "processing");
  assert.ok(submitted.processedAt, "Should have processedAt timestamp");
});

test("ErasureRequestService.submitRequest is idempotent", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  // Submit first time
  const first = service.submitRequest(created.erasureId);
  // Submit second time - should be no-op
  const second = service.submitRequest(created.erasureId);

  assert.equal(first.erasureId, second.erasureId);
  assert.equal(first.status, second.status);
});

test("ErasureRequestService.submitRequest throws on non-existent request", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  assert.throws(
    () => service.submitRequest("erasure_nonexistent"),
    (err: any) => err.code.startsWith("erasure.not_found"),
  );
});

test("ErasureRequestService.completeRequest transitions to completed with evidence", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  service.submitRequest(created.erasureId);

  const evidenceRefs = [
    { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
    { evidenceType: "data_purge", referenceId: "purge-001", timestamp: "2026-04-21T00:01:00.000Z" },
  ];

  const completed = service.completeRequest(created.erasureId, evidenceRefs);

  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt, "Should have completedAt timestamp");
  assert.equal(completed.evidenceRefs.length, 2);
});

test("ErasureRequestService.completeRequest is a no-op when request is not processing", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  const result = service.completeRequest(created.erasureId, [
    { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
  ]);

  assert.equal(result.status, "pending");
  assert.equal(result.completedAt, null);
});

test("ErasureRequestService.failRequest transitions to failed with reason", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  service.submitRequest(created.erasureId);

  const failed = service.failRequest(created.erasureId, "DEK destruction failed");

  assert.equal(failed.status, "failed");
  assert.ok(failed.failedAt, "Should have failedAt timestamp");
  assert.equal(failed.failureReason, "DEK destruction failed");
});

test("ErasureRequestService.cancelRequest transitions pending to cancelled", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  const cancelled = service.cancelRequest(created.erasureId);

  assert.equal(cancelled.status, "cancelled");
});

test("ErasureRequestService.cancelRequest transitions processing to cancelled", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  service.submitRequest(created.erasureId);
  const cancelled = service.cancelRequest(created.erasureId);

  assert.equal(cancelled.status, "cancelled");
});

test("ErasureRequestService.cancelRequest does not cancel completed request", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  service.submitRequest(created.erasureId);
  service.completeRequest(created.erasureId, [
    { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
  ]);

  const result = service.cancelRequest(created.erasureId);

  // Status should remain completed
  assert.equal(result.status, "completed");
});

test("ErasureRequestService.getRequest retrieves request", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  const retrieved = service.getRequest(created.erasureId);

  assert.ok(retrieved);
  assert.equal(retrieved!.erasureId, created.erasureId);
});

test("ErasureRequestService.getRequest returns null for non-existent", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const retrieved = service.getRequest("erasure_nonexistent");

  assert.equal(retrieved, null);
});

test("ErasureRequestService.listRequestsByTenant returns tenant requests", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-1",
    requestedBy: "admin",
    reason: "Test 1",
  });

  service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-2",
    requestedBy: "admin",
    reason: "Test 2",
  });

  service.createRequest({
    tenantId: "tenant-456",
    subjectType: "user",
    subjectId: "user-3",
    requestedBy: "admin",
    reason: "Test 3",
  });

  const tenant123Requests = service.listRequestsByTenant("tenant-123");
  const tenant456Requests = service.listRequestsByTenant("tenant-456");

  assert.equal(tenant123Requests.length, 2);
  assert.equal(tenant456Requests.length, 1);
});

test("ErasureRequestService.listRequestsByStatus filters by status", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const req1 = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-1",
    requestedBy: "admin",
    reason: "Test 1",
  });

  const req2 = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-2",
    requestedBy: "admin",
    reason: "Test 2",
  });

  service.submitRequest(req1.erasureId);

  const pending = service.listRequestsByStatus("tenant-123", "pending");
  const processing = service.listRequestsByStatus("tenant-123", "processing");

  assert.equal(pending.length, 1);
  assert.equal(processing.length, 1);
});

test("ErasureRequestService.listRequestsByTraceId returns requests with trace", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const req1 = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-1",
    requestedBy: "admin",
    reason: "Test 1",
    traceId: "trace_correlation_123",
  });

  service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-2",
    requestedBy: "admin",
    reason: "Test 2",
    traceId: "trace_other",
  });

  const traced = service.listRequestsByTraceId("trace_correlation_123");

  assert.equal(traced.length, 1);
  assert.equal(traced[0]!.erasureId, req1.erasureId);
});

test("ErasureRequestService emits events during lifecycle", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  service.submitRequest(created.erasureId);

  service.completeRequest(
    created.erasureId,
    [
      { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
    ],
  );

  assert.equal(mockStore.events.length, 3);
  assert.equal(mockStore.events[0]!.eventType, "erasure:requested");
  assert.equal(mockStore.events[1]!.eventType, "erasure:processing");
  assert.equal(mockStore.events[2]!.eventType, "erasure:completed");
});

test("ErasureRequestService stores metadata in request", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const request = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
    notes: "Priority request",
    metadata: { source: "gdpr_portal", caseId: "CASE-123" },
  });

  assert.equal(request.notes, "Priority request");
  assert.ok(request.metadataJson);
  const parsedMetadata = JSON.parse(request.metadataJson!);
  assert.equal(parsedMetadata.source, "gdpr_portal");
  assert.equal(parsedMetadata.caseId, "CASE-123");
});

test("ErasureRequestService handles erasure subject types", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const subjectTypes: Array<"user" | "workspace" | "tenant" | "execution" | "task" | "custom"> = [
    "user",
    "workspace",
    "tenant",
    "execution",
    "task",
    "custom",
  ];

  for (const subjectType of subjectTypes) {
    const request = service.createRequest({
      tenantId: "tenant-123",
      subjectType,
      subjectId: `${subjectType}-1`,
      requestedBy: "admin",
      reason: `Test ${subjectType}`,
    });

    assert.equal(request.subjectType, subjectType);
  }
});

test("ErasureRequestService handles legal basis options", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const legalBases: Array<"gdpr_article_17" | "gdpr_article_17_1" | "gdpr_article_17_3" | "other"> = [
    "gdpr_article_17",
    "gdpr_article_17_1",
    "gdpr_article_17_3",
    "other",
  ];

  for (const legalBasis of legalBases) {
    const request = service.createRequest({
      tenantId: "tenant-123",
      subjectType: "user",
      subjectId: `user-${legalBasis}`,
      requestedBy: "admin",
      reason: "Test",
      legalBasis,
    });

    assert.equal(request.legalBasis, legalBasis);
  }
});

test("ErasureRequestService keeps status unchanged on non-processing terminal operations", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  const completedResult = service.completeRequest(created.erasureId, [
    { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
  ]);
  assert.equal(completedResult.status, "pending");

  const failedResult = service.failRequest(created.erasureId, "Test failure");
  assert.equal(failedResult.status, "pending");
});

test("ErasureRequestService.failRequest is idempotent when not processing", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-fail-idem",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  // Submit then complete
  service.submitRequest(created.erasureId);
  service.completeRequest(created.erasureId, [
    { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
  ]);

  // Try to fail completed request - should be no-op
  const result = service.failRequest(created.erasureId, "Should not change");

  // Status should remain completed
  assert.equal(result.status, "completed");
});

test("ErasureRequestService.failRequest throws on non-existent request", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  assert.throws(
    () => service.failRequest("nonexistent_erasure", "Some reason"),
    (err: any) => err.code.startsWith("erasure.not_found"),
  );
});

test("ErasureRequestService.completeRequest is idempotent when not processing", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  const created = service.createRequest({
    tenantId: "tenant-complete-idem",
    subjectType: "user",
    subjectId: "user-456",
    requestedBy: "admin",
    reason: "Test erasure",
  });

  // Submit first
  service.submitRequest(created.erasureId);

  // Complete first time
  const first = service.completeRequest(created.erasureId, [
    { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
  ]);

  // Complete second time - should be no-op
  const second = service.completeRequest(created.erasureId, [
    { evidenceType: "dek_destruction", referenceId: "key-002", timestamp: "2026-04-21T00:01:00.000Z" },
  ]);

  // Should return same status
  assert.equal(first.status, second.status);
  assert.equal(first.completedAt, second.completedAt);
});

test("ErasureRequestService.completeRequest throws on non-existent request", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(mockStore);
  const service = new ErasureRequestService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.completeRequest("nonexistent_erasure", [
        { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: "2026-04-21T00:00:00.000Z" },
      ]),
    (err: any) => err.code.startsWith("erasure.not_found"),
  );
});
