import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  RemoteWorkerRegistrationService,
  type IssueRemoteWorkerRegistrationChallengeInput,
  type CompleteRemoteWorkerRegistrationInput,
} from "../../../../../src/platform/five-plane-execution/worker-pool/worker/remote-worker-registration-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb(): SqliteDatabase {
  const db = new SqliteDatabase(":memory:");
  db.migrate();
  return db;
}

function createService(db?: SqliteDatabase): RemoteWorkerRegistrationService {
  const database = db ?? createTestDb();
  const store = new AuthoritativeTaskStore(database);
  return new RemoteWorkerRegistrationService(database, store);
}

// ---------------------------------------------------------------------------
// issueChallenge - basic behavior
// ---------------------------------------------------------------------------

test("issueChallenge returns issued=true for valid request", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "edit"],
  });

  assert.equal(decision.issued, true);
  assert.equal(decision.reasonCode, null);
  assert.ok(decision.challengeId !== null);
  assert.ok(decision.challengeToken !== null);
  assert.ok(decision.expiresAt !== null);
});

test("issueChallenge stores challenge token as challenge-scoped HMAC", () => {
  const db = createTestDb();
  const service = createService(db);

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const row = db.connection
    .prepare(`SELECT challenge_token_hash AS challengeTokenHash FROM worker_registration_challenges WHERE id = ?`)
    .get(decision.challengeId!) as { challengeTokenHash: string };
  const expected = createHmac("sha256", decision.challengeId!).update(decision.challengeToken!, "utf8").digest("hex");
  const legacy = createHash("sha256").update(decision.challengeToken!, "utf8").digest("hex");

  assert.equal(row.challengeTokenHash, expected);
  assert.notEqual(row.challengeTokenHash, legacy);
});

test("issueChallenge includes allowed capabilities in response", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "edit"],
  });

  assert.deepEqual(decision.allowedCapabilities.sort(), ["bash", "edit"]);
  assert.deepEqual(decision.rejectedCapabilities, []);
});

test("issueChallenge returns issued=false when capability not allowed", () => {
  const db = createTestDb();
  const store = new AuthoritativeTaskStore(db);
  const service = new RemoteWorkerRegistrationService(db, store, {
    allowedCapabilities: ["bash"],
  });

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "mcp"],
  });

  assert.equal(decision.issued, false);
  assert.equal(decision.reasonCode, "capability_not_allowed");
  assert.ok(decision.challengeId === null);
  assert.ok(decision.challengeToken === null);
  assert.deepEqual(decision.allowedCapabilities, ["bash"]);
  assert.deepEqual(decision.rejectedCapabilities, ["mcp"]);
});

test("issueChallenge returns issued=false when ttl is invalid", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: -100,
  });

  assert.equal(decision.issued, false);
  assert.equal(decision.reasonCode, "challenge_ttl_invalid");
});

test("issueChallenge returns issued=false when ttl is zero", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: 0,
  });

  assert.equal(decision.issued, false);
  assert.equal(decision.reasonCode, "challenge_ttl_invalid");
});

test("issueChallenge uses default TTL when not specified", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  assert.equal(decision.issued, true);
  assert.ok(decision.expiresAt !== null);
  const expires = new Date(decision.expiresAt!);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  assert.ok(diffMs > 0 && diffMs <= 310_000); // Default is 300000ms with some tolerance
});

test("issueChallenge handles empty capabilities list", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: [],
  });

  assert.equal(decision.issued, true);
  assert.deepEqual(decision.allowedCapabilities, []);
});

test("issueChallenge normalizes capability whitespace", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["  bash  ", "edit"],
  });

  assert.equal(decision.issued, true);
  assert.ok(decision.allowedCapabilities.includes("bash"));
});

test("issueChallenge deduplicates requested capabilities", () => {
  const service = createService();

  const decision = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash", "bash", "edit"],
  });

  assert.equal(decision.issued, true);
  assert.equal(decision.allowedCapabilities.filter(c => c === "bash").length, 1);
});

// ---------------------------------------------------------------------------
// completeRegistration - basic behavior
// ---------------------------------------------------------------------------

test("completeRegistration returns accepted=true for valid challenge", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, null);
  assert.ok(decision.registrationVerifiedAt !== null);
  assert.ok(decision.registrationChallengeId !== null);
});

test("completeRegistration returns accepted=false when challenge not found", () => {
  const service = createService();

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: "nonexistent-challenge",
    challengeToken: "any-token",
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "challenge_not_found");
});

test("completeRegistration returns accepted=false when worker ID mismatch", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-2", // Different worker ID
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "challenge_worker_mismatch");
});

test("completeRegistration returns accepted=false when challenge already used", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  // First registration completes successfully
  service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  // Attempt to use same challenge again
  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "challenge_already_used");
});

test("completeRegistration returns accepted=false when challenge expired", () => {
  const db = createTestDb();
  const store = new AuthoritativeTaskStore(db);
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
    ttlMs: 1000, // 1 second TTL
  });

  // Force the challenge to be expired by directly updating expiresAt in the database
  db.connection.prepare(`UPDATE worker_registration_challenges SET expires_at = ? WHERE id = ?`)
    .run("2020-01-01T00:00:00.000Z", challenge.challengeId!);

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "challenge_expired");
});

test("completeRegistration returns accepted=false when token invalid", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: "wrong-token",
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "challenge_token_invalid");
});

test("completeRegistration accepts legacy sha256 challenge hashes with timing-safe migration compatibility", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });
  const legacyHash = createHash("sha256").update(challenge.challengeToken!, "utf8").digest("hex");
  db.connection.prepare(`UPDATE worker_registration_challenges SET challenge_token_hash = ? WHERE id = ?`)
    .run(legacyHash, challenge.challengeId!);

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, null);
});

test("completeRegistration returns accepted=false when capability not allowed", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["mcp"], // Not in allowed list
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "capability_not_allowed");
});

// ---------------------------------------------------------------------------
// completeRegistration - edge cases
// ---------------------------------------------------------------------------

test("completeRegistration handles optional isolationLevel", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
    isolationLevel: "hardened",
  });

  assert.equal(decision.accepted, true);
});

test("completeRegistration handles optional remoteSessionStatus", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash"],
    maxConcurrency: 5,
    remoteSessionStatus: "connected",
  });

  assert.equal(decision.accepted, true);
});

test("completeRegistration normalizes capability whitespace", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["  bash  "],
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, true);
});

test("completeRegistration rejects when requested more than allowed", () => {
  const db = createTestDb();
  const service = createService(db);

  const challenge = service.issueChallenge({
    workerId: "worker-1",
    requestedCapabilities: ["bash"],
  });

  // Challenge allows bash, but registration requests more
  const decision = service.completeRegistration({
    workerId: "worker-1",
    challengeId: challenge.challengeId!,
    challengeToken: challenge.challengeToken!,
    capabilities: ["bash", "edit", "mcp"], // More than challenged
    maxConcurrency: 5,
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "capability_not_allowed");
});
