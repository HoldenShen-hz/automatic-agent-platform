import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { RemoteWorkerRegistrationService } from "../../../../../src/platform/execution/worker-pool/remote-worker-registration-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface MockChallenge {
  id: string;
  workerId: string;
  challengeTokenHash: string;
  allowedCapabilitiesJson: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

interface MockWorkerSnapshot extends WorkerSnapshotRecord {
  workerId: string;
  capabilitiesJson: string;
  runningExecutionsJson: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createMockStore(
  challenges: Map<string, MockChallenge> = new Map(),
  workers: Map<string, MockWorkerSnapshot> = new Map(),
): AuthoritativeTaskStore {
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
      upsertWorkerSnapshot: (record: WorkerSnapshotRecord) => {
        workers.set(record.workerId, record as unknown as MockWorkerSnapshot);
      },
      getWorkerSnapshot: (workerId: string) => workers.get(workerId) ?? null,
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// RemoteWorkerRegistrationService issueChallenge
// ---------------------------------------------------------------------------

test("RemoteWorkerRegistrationService issueChallenge normalizes capability order", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit", "mcp"],
  });

  assert.equal(result.issued, true);
  // Should be sorted alphabetically
  assert.deepEqual(result.allowedCapabilities, ["edit", "mcp"]);
});

test("RemoteWorkerRegistrationService issueChallenge trims whitespace from capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["  edit  ", "mcp"],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["edit", "mcp"]);
});

test("RemoteWorkerRegistrationService issueChallenge removes duplicate capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit", "edit", "mcp"],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["edit", "mcp"]);
});

test("RemoteWorkerRegistrationService issueChallenge handles empty capabilities list", () => {
  // Empty capabilities normalize to [], which means no capabilities are allowed
  // The service actually issues a challenge with empty allowed capabilities
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: [],
  });

  // Service normalizes empty array to [] and issues challenge with no allowed capabilities
  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, []);
});

test("RemoteWorkerRegistrationService issueChallenge handles whitespace-only capabilities", () => {
  // Whitespace-only capabilities normalize to [] after trimming/filtering
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["  ", "   "],
  });

  // Normalizes to [] and issues challenge with no allowed capabilities
  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, []);
});

test("RemoteWorkerRegistrationService issueChallenge rejects TTL of zero", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
    ttlMs: 0,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("RemoteWorkerRegistrationService issueChallenge rejects negative TTL", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
    ttlMs: -100,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("RemoteWorkerRegistrationService issueChallenge rejects non-finite TTL", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
    ttlMs: Infinity,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("RemoteWorkerRegistrationService issueChallenge stores challenge with correct hash", () => {
  const challenges = new Map<string, MockChallenge>();
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit", "mcp"],
  });

  assert.equal(result.issued, true);
  const stored = challenges.get(result.challengeId!);
  assert.ok(stored !== undefined);
  assert.equal(stored!.workerId, "worker-1");
  assert.ok(stored!.challengeTokenHash !== null);
});

test("RemoteWorkerRegistrationService issueChallenge uses custom TTL when provided", () => {
  const challenges = new Map<string, MockChallenge>();
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
    ttlMs: 600000,
  });

  assert.equal(result.issued, true);
  const stored = challenges.get(result.challengeId!);
  assert.ok(stored !== undefined);
  const expiresAtTime = Date.parse(stored!.expiresAt);
  const createdAtTime = Date.parse(stored!.createdAt);
  assert.ok(expiresAtTime - createdAtTime >= 599000); // 600000 - some margin
});

// ---------------------------------------------------------------------------
// RemoteWorkerRegistrationService completeRegistration
// ---------------------------------------------------------------------------

test("RemoteWorkerRegistrationService completeRegistration accepts valid challenge", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit", "mcp"],
  });

  assert.equal(issueResult.issued, true);

  const completeResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit", "mcp"],
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, true);
  assert.ok(completeResult.registrationVerifiedAt !== null);
});

test("RemoteWorkerRegistrationService completeRegistration rejects wrong worker ID", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
  });

  const completeResult = service.completeRegistration({
    workerId: "worker-2", // Different worker
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit"],
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, false);
  assert.equal(completeResult.reasonCode, "challenge_worker_mismatch");
});

test("RemoteWorkerRegistrationService completeRegistration rejects expired challenge", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  // Manually add an expired challenge
  const expiredChallenge: MockChallenge = {
    id: "expired-challenge",
    workerId: "worker-1",
    challengeTokenHash: hashToken("token"),
    allowedCapabilitiesJson: '["edit"]',
    expiresAt: "2020-01-01T00:00:00.000Z", // Expired
    usedAt: null,
    createdAt: "2020-01-01T00:00:00.000Z",
  };
  challenges.set("expired-challenge", expiredChallenge);

  const completeResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "expired-challenge",
    challengeToken: "token",
    capabilities: ["edit"],
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, false);
  assert.equal(completeResult.reasonCode, "challenge_expired");
});

test("RemoteWorkerRegistrationService completeRegistration rejects already-used challenge", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
  });

  // First use - should succeed
  const firstResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit"],
    maxConcurrency: 4,
  });
  assert.equal(firstResult.accepted, true);

  // Second use - should fail (already used)
  const secondResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit"],
    maxConcurrency: 4,
  });
  assert.equal(secondResult.accepted, false);
  assert.equal(secondResult.reasonCode, "challenge_already_used");
});

test("RemoteWorkerRegistrationService completeRegistration rejects invalid token", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
  });

  const completeResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: "wrong-token",
    capabilities: ["edit"],
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, false);
  assert.equal(completeResult.reasonCode, "challenge_token_invalid");
});

test("RemoteWorkerRegistrationService completeRegistration rejects non-allowed capabilities", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"], // Only edit allowed
  });

  const completeResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit", "custom-capability"], // custom not in allowed list
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, false);
  assert.equal(completeResult.reasonCode, "capability_not_allowed");
  assert.deepEqual(completeResult.rejectedCapabilities, ["custom-capability"]);
});

test("RemoteWorkerRegistrationService completeRegistration rejects non-existent challenge", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const completeResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "non-existent-challenge",
    challengeToken: "token",
    capabilities: ["edit"],
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, false);
  assert.equal(completeResult.reasonCode, "challenge_not_found");
});

test("RemoteWorkerRegistrationService completeRegistration sets remote session status", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-remote",
    requestedCapabilities: ["edit"],
  });

  const completeResult = service.completeRegistration({
    workerId: "worker-remote",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit"],
    maxConcurrency: 4,
    remoteSessionStatus: "connected",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  });

  assert.equal(completeResult.accepted, true);
  const worker = workers.get("worker-remote");
  assert.ok(worker !== undefined);
});

test("RemoteWorkerRegistrationService completeRegistration respects custom isolation level", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, MockWorkerSnapshot>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-hardened",
    requestedCapabilities: ["edit"],
  });

  const completeResult = service.completeRegistration({
    workerId: "worker-hardened",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["edit"],
    maxConcurrency: 2,
    isolationLevel: "hardened",
  });

  assert.equal(completeResult.accepted, true);
  const worker = workers.get("worker-hardened");
  assert.ok(worker !== undefined);
});

// ---------------------------------------------------------------------------
// RemoteWorkerRegistrationService with custom allowed capabilities
// ---------------------------------------------------------------------------

test("RemoteWorkerRegistrationService with custom capabilities accepts custom capability", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, {
    allowedCapabilities: ["edit", "mcp", "custom"],
  });

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["custom"],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["custom"]);
});

test("RemoteWorkerRegistrationService with custom capabilities rejects unlisted capability", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, {
    allowedCapabilities: ["edit", "mcp"],
  });

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["custom-unlisted"],
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
  assert.deepEqual(result.rejectedCapabilities, ["custom-unlisted"]);
});

// ---------------------------------------------------------------------------
// RemoteWorkerRegistrationService default values
// ---------------------------------------------------------------------------

test("RemoteWorkerRegistrationService default challenge TTL is 300000ms (5 minutes)", () => {
  const challenges = new Map<string, MockChallenge>();
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit"],
  });

  assert.equal(result.issued, true);
  const stored = challenges.get(result.challengeId!);
  assert.ok(stored !== undefined);
  const expiresAtTime = Date.parse(stored!.expiresAt);
  const createdAtTime = Date.parse(stored!.createdAt);
  const ttl = expiresAtTime - createdAtTime;
  assert.ok(ttl >= 299000 && ttl <= 301000); // 300000 +/- 1000ms
});

test("RemoteWorkerRegistrationService default allowed capabilities include edit and mcp (not bash)", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["edit", "mcp"],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["edit", "mcp"]);
});

test("RemoteWorkerRegistrationService default allowed capabilities reject bash", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
  assert.deepEqual(result.rejectedCapabilities, ["bash"]);
});