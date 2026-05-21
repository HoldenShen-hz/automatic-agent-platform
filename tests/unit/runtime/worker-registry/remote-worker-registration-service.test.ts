import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { RemoteWorkerRegistrationService } from "../../../../../../src/platform/five-plane-execution/worker-pool/worker/remote-worker-registration-service.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashTokenLegacy(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function hashToken(token: string, challengeId: string): string {
  return createHmac("sha256", challengeId).update(token, "utf8").digest("hex");
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

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

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

test("RemoteWorkerRegistrationService constructor defaults to bash, edit, mcp capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  assert.ok(service);
});

// ---------------------------------------------------------------------------
// issueChallenge - basic functionality
// ---------------------------------------------------------------------------

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

test("issueChallenge returns challenge with valid ID format", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  // Challenge ID should start with "wchal" prefix
  assert.ok(result.challengeId!.startsWith("wchal"));
  // Token should be 48 hex characters (24 bytes)
  assert.equal(result.challengeToken!.length, 48);
});

test("issueChallenge returns challenge with valid expiresAt", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const before = new Date().toISOString();
  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: 300000,
  });
  const after = new Date().toISOString();

  assert.ok(result.expiresAt! > before);
  assert.ok(result.expiresAt! < after || result.expiresAt! >= before);
});

// ---------------------------------------------------------------------------
// issueChallenge - capability filtering
// ---------------------------------------------------------------------------

test("issueChallenge rejects when TTL is invalid - zero", () => {
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
  assert.equal(result.challengeId, null);
  assert.equal(result.challengeToken, null);
});

test("issueChallenge rejects when TTL is invalid - negative", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: -1000,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("issueChallenge rejects when TTL is invalid - Infinity", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: Infinity,
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "challenge_ttl_invalid");
});

test("issueChallenge rejects disallowed capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "disallowed-capability"],
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
  assert.deepEqual(result.rejectedCapabilities, ["disallowed-capability"]);
});

test("issueChallenge rejects all capabilities when none allowed", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, { allowedCapabilities: [] });

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  assert.equal(result.issued, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
});

test("issueChallenge accepts subset of allowed capabilities", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "mcp", "custom"],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["bash", "mcp"]);
  assert.deepEqual(result.rejectedCapabilities, ["custom"]);
});

// ---------------------------------------------------------------------------
// issueChallenge - normalization
// ---------------------------------------------------------------------------

test("issueChallenge normalizes capabilities with whitespace", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["  bash  ", "edit", "bash"],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["bash", "edit"]);
});

test("issueChallenge removes empty capability strings", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "", "  "],
  });

  assert.equal(result.issued, true);
  assert.deepEqual(result.allowedCapabilities, ["bash"]);
});

// ---------------------------------------------------------------------------
// issueChallenge - challenge persistence
// ---------------------------------------------------------------------------

test("issueChallenge stores challenge in mock store", () => {
  const challenges = new Map<string, MockChallenge>();
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  assert.ok(result.challengeId != null);
  assert.ok(challenges.has(result.challengeId!));
  const stored = challenges.get(result.challengeId!);
  assert.equal(stored!.workerId, "worker-1");
  assert.equal(stored!.usedAt, null);
});

// ---------------------------------------------------------------------------
// completeRegistration - basic functionality
// ---------------------------------------------------------------------------

test("completeRegistration accepts valid challenge", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const completeResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(completeResult.accepted, true);
  assert.equal(completeResult.reasonCode, null);
  assert.equal(completeResult.workerId, "worker-1");
  assert.ok(completeResult.registrationVerifiedAt != null);
  assert.equal(completeResult.registrationChallengeId, issueResult.challengeId);
});

// ---------------------------------------------------------------------------
// completeRegistration - error cases
// ---------------------------------------------------------------------------

test("completeRegistration rejects challenge not found", () => {
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
  assert.equal(result.workerId, "worker-1");
});

test("completeRegistration rejects worker ID mismatch", () => {
  const challenges = new Map<string, MockChallenge>();
  const store = createMockStore(challenges);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const result = service.completeRegistration({
    workerId: "worker-2", // Different worker ID
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_worker_mismatch");
});

test("completeRegistration rejects already used challenge", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  // First use succeeds
  service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  // Second use fails
  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_already_used");
});

test("completeRegistration rejects expired challenge", () => {
  const challengeId = "wchal_expired";
  const challengeToken = randomBytes(24).toString("hex");
  const challenges = new Map<string, MockChallenge>([[challengeId, {
    id: challengeId,
    workerId: "worker-1",
    challengeTokenHash: hashToken(challengeToken, challengeId),
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2020-01-01T00:00:00.000Z", // Expired
    usedAt: null,
    createdAt: "2020-01-01T00:00:00.000Z",
  }]]);
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challengeId,
    challengeToken: challengeToken,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_expired");
});

test("completeRegistration rejects invalid token", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: "invalid-token-value",
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "challenge_token_invalid");
});

test("completeRegistration rejects disallowed capabilities", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store, { allowedCapabilities: ["bash", "edit"] });

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash", "mcp"], // MCP not in allowed list
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "capability_not_allowed");
  assert.deepEqual(result.rejectedCapabilities, ["mcp"]);
});

// ---------------------------------------------------------------------------
// completeRegistration - HMAC compatibility
// ---------------------------------------------------------------------------

test("completeRegistration accepts legacy token format", () => {
  const challengeId = "wchal_legacy";
  const challengeToken = randomBytes(24).toString("hex");
  const challenges = new Map<string, MockChallenge>([[challengeId, {
    id: challengeId,
    workerId: "worker-1",
    challengeTokenHash: hashTokenLegacy(challengeToken), // Legacy hash without challenge ID
    allowedCapabilitiesJson: JSON.stringify(["bash"]),
    expiresAt: "2030-01-01T00:00:00.000Z", // Not expired
    usedAt: null,
    createdAt: "2020-01-01T00:00:00.000Z",
  }]]);
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challengeId,
    challengeToken: challengeToken,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });

  assert.equal(result.accepted, true);
});

// ---------------------------------------------------------------------------
// completeRegistration - worker registration
// ---------------------------------------------------------------------------

test("completeRegistration calls verifyRemoteWorkerRegistration", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "edit"],
  });

  const result = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash", "edit"],
    maxConcurrency: 8,
    queueAffinity: "test-queue",
    isolationLevel: "hardened",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.allowedCapabilities.length, 2);
  assert.ok(workers.has("worker-1"));
});

// ---------------------------------------------------------------------------
// completeRegistration - timing safety
// ---------------------------------------------------------------------------

test("completeRegistration uses timing-safe comparison", () => {
  const challenges = new Map<string, MockChallenge>();
  const workers = new Map<string, unknown>();
  const store = createMockStore(challenges, workers);
  const db = createMockDb();
  const service = new RemoteWorkerRegistrationService(db, store);

  const issueResult = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  // Valid token should work
  const validResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: issueResult.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 4,
  });
  assert.equal(validResult.accepted, true);

  // Invalid token should fail even with timing attack prevention
  const invalidResult = service.completeRegistration({
    workerId: "worker-1",
    challengeId: issueResult.challengeId!,
    challengeToken: "a".repeat(48),
    capabilities: ["bash"],
    maxConcurrency: 4,
  });
  assert.equal(invalidResult.accepted, false);
  assert.equal(invalidResult.reasonCode, "challenge_token_invalid");
});
