import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { WorkerServiceIdentityRegistry } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-service-identity.js";

function createStore(existingSnapshot?: Record<string, unknown>) {
  let snapshot = existingSnapshot ?? null;
  return {
    worker: {
      listWorkerSnapshots: () => (snapshot ? [snapshot] : []),
      getWorkerSnapshot: (_workerId: string) => snapshot,
      upsertWorkerSnapshot: (nextSnapshot: Record<string, unknown>) => {
        snapshot = nextSnapshot;
      },
    },
  } as any;
}

test("WorkerServiceIdentityRegistry rejects overwriting a verified worker fingerprint", () => {
  const registry = new WorkerServiceIdentityRegistry(createStore({
    workerId: "worker-1",
    status: "idle",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"],
    registrationVerifiedAt: "2026-05-07T00:00:00.000Z",
    version: 1,
  }));

  assert.throws(
    () => registry.register({
      workerId: "worker-1",
      serviceIdentity: "service-a",
      mtlsPeerFingerprint: "fp-456",
      allowedNodeRunTenants: ["tenant-1"],
    }),
    (error: unknown) =>
      error instanceof ValidationError
      && error.code === "worker_identity.verified_identity_overwrite_denied",
  );
});
