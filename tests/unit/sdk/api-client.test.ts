/**
 * @fileoverview Unit tests for Client SDK (src/sdk/client-sdk/api-client.ts)
 * Covers R3-38 version headers, R8-22 PlanGraphBundle API (ContractEnvelope)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import {
  buildApiUrl,
  buildAuthHeaders,
  createApiClient,
  createContractEnvelope,
  wrapInContractEnvelope,
  unwrapContractEnvelope,
  parseCursor,
  encodeCursor,
  RetryableApiClient,
  type ApiClientConfig,
  type ApiRequestSpec,
} from "../../../src/sdk/client-sdk/api-client.js";

import type { PlanGraphBundle, PlanNode, PlanEdge } from "../../../src/platform/contracts/executable-contracts/index.js";

// ============================================================================
// R3-38: Version Headers - X-Platform-Version, X-SDK-Version, X-Contract-Version
// ============================================================================

test("buildAuthHeaders includes X-Platform-Version when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    platformVersion: "v4.3.0",
  };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-Platform-Version"], "v4.3.0");
});

test("buildAuthHeaders includes X-SDK-Version when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.2.0",
  };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-SDK-Version"], "1.2.0");
});

test("buildAuthHeaders includes X-Contract-Version when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    contractVersion: "5.2.0",
  };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-Contract-Version"], "5.2.0");
});

test("buildAuthHeaders includes all version headers when all configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    platformVersion: "v4.3.0",
    sdkVersion: "1.2.0",
    contractVersion: "5.2.0",
  };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-Platform-Version"], "v4.3.0");
  assert.equal(headers["X-SDK-Version"], "1.2.0");
  assert.equal(headers["X-Contract-Version"], "5.2.0");
});

test("buildAuthHeaders omits version headers when not configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-Platform-Version"], undefined);
  assert.equal(headers["X-SDK-Version"], undefined);
  assert.equal(headers["X-Contract-Version"], undefined);
});

// ============================================================================
// R8-22: PlanGraphBundle API - ContractEnvelope creation and manipulation
// ============================================================================

test("createContractEnvelope creates envelope with required fields", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const envelope = createContractEnvelope({
    payload: { query: "test" },
    principal,
  });

  assert.ok(envelope.envelopeId.startsWith("env_"));
  assert.equal(envelope.schemaVersion, "v4.3");
  assert.ok(envelope.commandId.startsWith("cmd_"));
  assert.ok(envelope.correlationId.startsWith("corr_"));
  assert.equal(envelope.signature, null);
  assert.deepEqual(envelope.principal, principal);
  assert.ok(envelope.timestamp.length > 0);
  assert.deepEqual(envelope.payload, { query: "test" });
  assert.deepEqual(envelope.metadata, {});
});

test("createContractEnvelope accepts custom schemaVersion", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const envelope = createContractEnvelope({
    payload: { data: 123 },
    principal,
    schemaVersion: "v5.0",
  });

  assert.equal(envelope.schemaVersion, "v5.0");
});

test("createContractEnvelope accepts custom commandId", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const envelope = createContractEnvelope({
    payload: {},
    principal,
    commandId: "cmd_custom_123",
  });

  assert.equal(envelope.commandId, "cmd_custom_123");
});

test("createContractEnvelope accepts custom correlationId", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const envelope = createContractEnvelope({
    payload: {},
    principal,
    correlationId: "corr_custom_456",
  });

  assert.equal(envelope.correlationId, "corr_custom_456");
});

test("createContractEnvelope accepts signature", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const envelope = createContractEnvelope({
    payload: {},
    principal,
    signature: "sig_abc123",
  });

  assert.equal(envelope.signature, "sig_abc123");
});

test("createContractEnvelope accepts custom metadata", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const metadata = { source: "client", traceId: "trace_789" } as const;
  const envelope = createContractEnvelope({
    payload: {},
    principal,
    metadata,
  });

  assert.deepEqual(envelope.metadata, metadata);
});

test("wrapInContractEnvelope creates envelope with system-generated IDs", () => {
  const principal = { principalId: "p_789", tenantId: "t_789", roles: ["operator"] };
  const envelope = wrapInContractEnvelope(
    { action: "execute" },
    principal,
  );

  assert.ok(envelope.envelopeId.startsWith("env_"));
  assert.ok(envelope.commandId.startsWith("cmd_"));
  assert.ok(envelope.correlationId.startsWith("corr_"));
  assert.equal(envelope.payload.action, "execute");
});

test("unwrapContractEnvelope extracts payload from envelope", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const originalPayload = {
    planNodes: [{ nodeId: "n1" }, { nodeId: "n2" }] as PlanNode[],
    planEdges: [{ edgeId: "e1" }] as PlanEdge[],
  };
  const envelope = createContractEnvelope({
    payload: originalPayload,
    principal,
  });

  const extracted = unwrapContractEnvelope(envelope);
  assert.deepEqual(extracted, originalPayload);
});

test("wrapInContractEnvelope with optional parameters", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] };
  const envelope = wrapInContractEnvelope(
    { bundleId: "bundle_1" },
    principal,
    {
      schemaVersion: "v5.0",
      commandId: "cmd_custom",
      correlationId: "corr_custom",
      signature: "sig_xyz",
      metadata: { origin: "test" },
    },
  );

  assert.equal(envelope.schemaVersion, "v5.0");
  assert.equal(envelope.commandId, "cmd_custom");
  assert.equal(envelope.correlationId, "corr_custom");
  assert.equal(envelope.signature, "sig_xyz");
  assert.deepEqual(envelope.metadata, { origin: "test" });
});

// ============================================================================
// ContractEnvelope with PlanGraphBundle payload (R8-22)
// ============================================================================

test("ContractEnvelope wraps PlanGraphBundle payload correctly", () => {
  const principal = { principalId: "p_123", tenantId: "t_456", roles: ["planner"] };

  const mockBundle: PlanGraphBundle = {
    planGraphBundleId: "pgb_123",
    harnessRunId: "harness_run_abc",
    graphVersion: 1,
    graph: {
      graphId: "graph_1",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all",
      graphHash: "hash_abc",
    },
    schedulerPolicy: {
      policyId: "scheduler:default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:default",
    riskProfile: { riskClass: "low", reasons: ["default"] },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: "2026-04-28T00:00:00.000Z",
  };

  const envelope = wrapInContractEnvelope(mockBundle, principal);

  assert.equal(envelope.payload.planGraphBundleId, "pgb_123");
  assert.equal(envelope.payload.harnessRunId, "harness_run_abc");
  assert.equal(envelope.payload.graphVersion, 1);
  assert.deepEqual(envelope.principal, principal);
});

// ============================================================================
// Cursor encoding/decoding roundtrip tests
// ============================================================================

test("encodeCursor and parseCursor roundtrip preserves data", () => {
  const pagination = { cursor: "cursor_abc123", limit: 50 };
  const encoded = encodeCursor(pagination);
  const decoded = parseCursor(encoded);
  assert.deepEqual(decoded, pagination);
});

test("parseCursor returns undefined for invalid base64", () => {
  assert.equal(parseCursor("!!!invalid-base64"), undefined);
});

test("parseCursor returns undefined for empty string", () => {
  assert.equal(parseCursor(""), undefined);
});

test("parseCursor rejects malformed or schema-drifting payloads", () => {
  const invalidPayloads: unknown[] = [
    null,
    [],
    "cursor",
    42,
    { cursor: 123 },
    { cursor: "cursor", limit: -1 },
    { cursor: "cursor", limit: 1.5 },
    { cursor: "cursor", limit: "50" },
    { cursor: "cursor", offset: 10 },
    { cursor: "cursor", limit: 10, extra: true },
  ];

  for (const payload of invalidPayloads) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    assert.equal(parseCursor(encoded), undefined, `payload should be rejected: ${JSON.stringify(payload)}`);
  }
});

test("parseCursor deterministic fuzz preserves valid cursor pagination only", () => {
  const validSeeds = [
    {},
    { cursor: "cursor_001" },
    { limit: 0 },
    { cursor: "cursor_002", limit: 1 },
    { cursor: "unicode_游标", limit: 500 },
    { cursor: "x".repeat(128), limit: Number.MAX_SAFE_INTEGER },
  ];

  for (const seed of validSeeds) {
    const encoded = encodeCursor(seed);
    assert.deepEqual(parseCursor(encoded), seed);
  }

  const invalidSeeds = Array.from({ length: 64 }, (_, index) => {
    const modulo = index % 8;
    if (modulo === 0) return { cursor: index };
    if (modulo === 1) return { limit: -index - 1 };
    if (modulo === 2) return { limit: index + 0.25 };
    if (modulo === 3) return { cursor: `cursor_${index}`, page: index };
    if (modulo === 4) return { cursor: null };
    if (modulo === 5) return [index, `cursor_${index}`];
    if (modulo === 6) return { cursor: `cursor_${index}`, limit: Number.NaN };
    return `cursor_${index}`;
  });

  for (const seed of invalidSeeds) {
    const encoded = Buffer.from(JSON.stringify(seed)).toString("base64");
    assert.equal(parseCursor(encoded), undefined, `fuzz seed should be rejected: ${JSON.stringify(seed)}`);
  }
});
