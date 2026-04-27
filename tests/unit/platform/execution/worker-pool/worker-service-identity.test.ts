import assert from "node:assert/strict";
import test from "node:test";

import { WorkerServiceIdentityRegistry } from "../../../../../src/platform/execution/worker-pool/worker-service-identity.js";

test("WorkerServiceIdentityRegistry.register stores identity", () => {
  const registry = new WorkerServiceIdentityRegistry();
  const identity = {
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"],
  };
  const result = registry.register(identity);
  assert.equal(result.workerId, "worker-1");
});

test("WorkerServiceIdentityRegistry.evaluateClaim returns accepted for valid claim", () => {
  const registry = new WorkerServiceIdentityRegistry();
  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1", "tenant-2"],
  });
  const decision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, "worker_identity.accepted");
});

test("WorkerServiceIdentityRegistry.evaluateClaim returns worker_unknown for unregistered worker", () => {
  const registry = new WorkerServiceIdentityRegistry();
  const decision = registry.evaluateClaim({
    workerId: "unknown-worker",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "worker_identity.worker_unknown");
});

test("WorkerServiceIdentityRegistry.evaluateClaim returns service_identity_mismatch", () => {
  const registry = new WorkerServiceIdentityRegistry();
  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"],
  });
  const decision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-b", // different service identity
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "worker_identity.service_identity_mismatch");
});

test("WorkerServiceIdentityRegistry.evaluateClaim returns mtls_mismatch", () => {
  const registry = new WorkerServiceIdentityRegistry();
  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"],
  });
  const decision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-456", // different fingerprint
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "worker_identity.mtls_mismatch");
});

test("WorkerServiceIdentityRegistry.evaluateClaim returns tenant_not_allowed", () => {
  const registry = new WorkerServiceIdentityRegistry();
  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1", "tenant-2"],
  });
  const decision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-3", // not in allowed list
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "worker_identity.tenant_not_allowed");
});

test("WorkerServiceIdentityRegistry.register returns the registered identity", () => {
  const registry = new WorkerServiceIdentityRegistry();
  const identity = {
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"],
  };
  const result = registry.register(identity);
  assert.deepEqual(result, identity);
});

test("WorkerServiceIdentityRegistry can register multiple workers", () => {
  const registry = new WorkerServiceIdentityRegistry();
  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-1",
    allowedNodeRunTenants: ["tenant-1"],
  });
  registry.register({
    workerId: "worker-2",
    serviceIdentity: "service-b",
    mtlsPeerFingerprint: "fp-2",
    allowedNodeRunTenants: ["tenant-2"],
  });

  const decision1 = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-1",
  });
  const decision2 = registry.evaluateClaim({
    workerId: "worker-2",
    nodeRunId: "nr-2",
    tenantId: "tenant-2",
    serviceIdentity: "service-b",
    mtlsPeerFingerprint: "fp-2",
  });

  assert.equal(decision1.accepted, true);
  assert.equal(decision2.accepted, true);
});
