import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { RemoteWorkerRegistrationService } from "../../../../../../src/platform/execution/worker-pool/worker/remote-worker-registration-service.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

interface MockChallenge {
  id: string;
  workerId: string;
  challengeTokenHash: string;
  allowedCapabilitiesJson: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createMockStore(challenges: Map<string, MockChallenge> = new Map(), workers: Map<string, unknown> = new Map()): AuthoritativeTaskStore {
  return {
    worker: {
      insertWorkerRegistrationChallenge: (challenge: MockChallenge) => {
        challenges.set(challenge.id, challenge);
      },
      getWorkerRegistrationChallenge: (challengeId: string) => challenges.get(challengeId) ?? null,
      consumeWorkerRegistrationChallenge: (_challengeId: string, _usedAt: string) => {
        const challenge = challenges.get(_challengeId);
        if (challenge) {
          challenge.usedAt = _usedAt;
        }
      },
      upsertWorkerSnapshot: (record: unknown) => {
        workers.set((record as { workerId: string }).workerId, record);
      },
      getWorkerSnapshot: (workerId: string) => workers.get(workerId) as MockChallenge ?? null,
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

test("RemoteWorkerRegistrationService constructor sets default capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  assert.ok(service);
});

test("RemoteWorkerRegistrationService constructor accepts custom capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, {
    allowedCapabilities: ["bash", "edit", "mcp", "custom"],
  });

  assert.ok(service);
});

test("RemoteWorkerRegistrationService constructor accepts custom challenge TTL", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, {
    challengeTtlMs: 600000,
  });

  assert.ok(service);
});

test("issueChallenge issues challenge for valid request", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "edit"],
  });

  assert.equal(result.issued, true);
  assert.equal(result.reasonCode, null);
  assert.ok(result.challengeId != null);
  assert.ok(result.challengeToken != null);
  assert.ok(result.expiresAt != null);
  assert.deepEqual(result.allowedCapabilities, ["bash", "edit"]);
  assert.deepEqual(result.rejectedCapabilities, []);
});

test("issueChallenge rejects when TTL is invalid", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: -100,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
  assert.equal(result.challengeId, null);
  assert.equal(result.challengeToken, null);
});

test("issueChallenge rejects when TTL is zero", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: 0,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("issueChallenge rejects when TTL is not finite", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: NaN,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("issueChallenge rejects capability not in allowed list", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "forbidden-capability"],
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
  assert.deepEqual(result.allowedCapabilities, ["bash"]);
  assert.deepEqual(result.rejectedCapabilities, ["forbidden-capability"]);
});

test("issueChallenge normalizes and deduplicates capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["  bash  ", "edit", "bash", "  edit  "],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["bash", "edit"]);
});

test("issueChallenge uses default TTL when not specified", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, { challengeTtlMs: 300000 });

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  assert.equal(result.issued, true);
  assert.ok(result.expiresAt != null);
});

test("issueChallenge applies custom TTL correctly", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: 600000,
  });

  assert.equal(result.issued, true);
  const issuedAt = new Date();
  const expiresAt = new Date(result.expiresAt!);
  const diffMs = expiresAt.getTime() - issuedAt.getTime();
  assert.ok(diffMs >= 599000 && diffMs <= 601000, `Expected ~600000ms, got ${diffMs}ms`);
});

test("completeRegistration rejects when challenge not found", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "nonexistent",
    challengeToken: "token",
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_not_found");
});

test("completeRegistration rejects when worker ID mismatch", () => {
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: "hash",
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-2",
    challengeId: "challenge-1",
    challengeToken: "token",
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_worker_mismatch");
});

test("completeRegistration rejects when challenge already used", () => {
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: "hash",
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "token",
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_already_used");
});

test("completeRegistration rejects when challenge expired", () => {
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: "hash",
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-01T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "token",
    capabilities: ["bash"],
    maxConcurrency: 4,
    occurredAt: "2026-04-02T00:00:00.000Z",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_expired");
});

test("completeRegistration rejects when token hash mismatch", () => {
  const tokenHash = hashToken("correct-token");
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: tokenHash,
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "wrong-token",
    capabilities: ["bash"],
    maxConcurrency: 4,
    occurredAt: "2026-04-01T12:00:00.000Z",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_token_invalid");
});

test("completeRegistration rejects when capability not allowed", () => {
  const tokenHash = hashToken("token");
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: tokenHash,
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "token",
    capabilities: ["bash", "forbidden"],
    maxConcurrency: 4,
    occurredAt: "2026-04-01T12:00:00.000Z",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
  assert.deepEqual(result.rejectedCapabilities, ["forbidden"]);
});

test("completeRegistration accepts valid registration", () => {
  const tokenHash = hashToken("valid-token");
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: tokenHash,
    allowedCapabilitiesJson: JSON.stringify(["bash", "edit"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "valid-token",
    capabilities: ["bash", "edit"],
    maxConcurrency: 4,
    occurredAt: "2026-04-01T12:00:00.000Z",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, null);
  assert.equal(result.workerId, "worker-1");
  assert.ok(result.registrationVerifiedAt != null);
  assert.equal(result.registrationChallengeId, "challenge-1");
});

test("completeRegistration marks challenge as used after acceptance", () => {
  const tokenHash = hashToken("valid-token");
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: tokenHash,
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "valid-token",
    capabilities: ["bash"],
    maxConcurrency: 4,
    occurredAt: "2026-04-01T12:00:00.000Z",
  });

  assert.equal(challenges.get("challenge-1")?.usedAt, "2026-04-01T12:00:00.000Z");
});

test("completeRegistration accepts with optional parameters", () => {
  const tokenHash = hashToken("token");
  const challenges = new Map<string, MockChallenge>();
  challenges.set("challenge-1", {
    id: "challenge-1",
    workerId: "worker-1",
    challengeTokenHash: tokenHash,
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2026-04-02T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "challenge-1",
    challengeToken: "token",
    capabilities: ["bash"],
    maxConcurrency: 4,
    queueAffinity: "queue-a",
    isolationLevel: "hardened",
    repoVersion: "v1.0.0",
    runtimeInstanceId: "instance-1",
    remoteSessionStatus: "connected",
    occurredAt: "2026-04-01T12:00:00.000Z",
  });

  assert.equal(result.accepted, true);
});
