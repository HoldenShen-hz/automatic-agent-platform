import test from "node:test";
import assert from "node:assert/strict";
import {
  sortTicketsForDeterministicDispatch,
  interleaveTicketsByTenant,
  hashDispatchSeed,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-ordering.js";
import type { ExecutionTicketRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * R6-4 tests: Execution dispatch ordering per §14.9
 * Verifies deterministic ticket ordering for dispatch.
 */

function createMockTicket(overrides: Partial<ExecutionTicketRecord> = {}): ExecutionTicketRecord {
  const baseTicket: ExecutionTicketRecord = {
    id: "ticket-default",
    executionId: "exec-default",
    taskId: "task-default",
    tenantId: "tenant-default",
    priority: "normal",
    queueName: "default-queue",
    requiredCapabilitiesJson: "[]",
    dispatchAfter: null,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    riskClass: "low",
    criticalPathRank: 0,
    schedulerSeed: "seed-default",
    ...overrides,
  };
  return baseTicket;
}

// ---------------------------------------------------------------------------
// sortTicketsForDeterministicDispatch tests
// ---------------------------------------------------------------------------

test("sortTicketsForDeterministicDispatch: empty array returns empty array", () => {
  const result = sortTicketsForDeterministicDispatch([]);
  assert.deepEqual(result, []);
});

test("sortTicketsForDeterministicDispatch: single ticket returns same ticket", () => {
  const ticket = createMockTicket({ id: "ticket-1", priority: "high" });
  const result = sortTicketsForDeterministicDispatch([ticket]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "ticket-1");
});

test("sortTicketsForDeterministicDispatch: orders by priority descending (critical first)", () => {
  const tickets = [
    createMockTicket({ id: "low", priority: "low" }),
    createMockTicket({ id: "critical", priority: "critical" }),
    createMockTicket({ id: "normal", priority: "normal" }),
    createMockTicket({ id: "urgent", priority: "urgent" }),
    createMockTicket({ id: "high", priority: "high" }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(result[0]?.id, "critical");
  assert.equal(result[1]?.id, "urgent");
  assert.equal(result[2]?.id, "high");
  assert.equal(result[3]?.id, "normal");
  assert.equal(result[4]?.id, "low");
});

test("sortTicketsForDeterministicDispatch: uses criticalPathRank as secondary sort when priorities equal", () => {
  const tickets = [
    createMockTicket({ id: "rank-0", priority: "high", criticalPathRank: 0 }),
    createMockTicket({ id: "rank-10", priority: "high", criticalPathRank: 10 }),
    createMockTicket({ id: "rank-5", priority: "high", criticalPathRank: 5 }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(result[0]?.id, "rank-10");
  assert.equal(result[1]?.id, "rank-5");
  assert.equal(result[2]?.id, "rank-0");
});

test("sortTicketsForDeterministicDispatch: uses riskClass as tertiary sort when priority and rank equal", () => {
  const tickets = [
    createMockTicket({ id: "risk-low", priority: "high", criticalPathRank: 5, riskClass: "low" }),
    createMockTicket({ id: "risk-critical", priority: "high", criticalPathRank: 5, riskClass: "critical" }),
    createMockTicket({ id: "risk-medium", priority: "high", criticalPathRank: 5, riskClass: "medium" }),
    createMockTicket({ id: "risk-high", priority: "high", criticalPathRank: 5, riskClass: "high" }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(result[0]?.id, "risk-critical");
  assert.equal(result[1]?.id, "risk-high");
  assert.equal(result[2]?.id, "risk-medium");
  assert.equal(result[3]?.id, "risk-low");
});

test("sortTicketsForDeterministicDispatch: uses schedulerSeed as final sort tiebreaker", () => {
  const tickets = [
    createMockTicket({ id: "seed-ccc", priority: "high", criticalPathRank: 5, riskClass: "low", schedulerSeed: "ccc" }),
    createMockTicket({ id: "seed-aaa", priority: "high", criticalPathRank: 5, riskClass: "low", schedulerSeed: "aaa" }),
    createMockTicket({ id: "seed-bbb", priority: "high", criticalPathRank: 5, riskClass: "low", schedulerSeed: "bbb" }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(result[0]?.id, "seed-aaa");
  assert.equal(result[1]?.id, "seed-bbb");
  assert.equal(result[2]?.id, "seed-ccc");
});

test("sortTicketsForDeterministicDispatch: handles undefined/null criticalPathRank", () => {
  const tickets = [
    createMockTicket({ id: "rank-undefined", priority: "normal", criticalPathRank: undefined }),
    createMockTicket({ id: "rank-null", priority: "normal", criticalPathRank: null }),
    createMockTicket({ id: "rank-5", priority: "normal", criticalPathRank: 5 }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  // undefined and null should both be treated as 0
  // rank-5 should be first
  assert.equal(result[0]?.id, "rank-5");
});

test("sortTicketsForDeterministicDispatch: handles undefined/null riskClass", () => {
  const tickets = [
    createMockTicket({ id: "risk-undefined", priority: "normal", riskClass: undefined }),
    createMockTicket({ id: "risk-null", priority: "normal", riskClass: null }),
    createMockTicket({ id: "risk-high", priority: "normal", riskClass: "high" }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  // high risk should be first, undefined/null treated as "low"
  assert.equal(result[0]?.id, "risk-high");
});

test("sortTicketsForDeterministicDispatch: handles undefined/null schedulerSeed", () => {
  const tickets = [
    createMockTicket({ id: "seed-undefined", priority: "normal", schedulerSeed: undefined }),
    createMockTicket({ id: "seed-null", priority: "normal", schedulerSeed: null }),
    createMockTicket({ id: "seed-apple", priority: "normal", schedulerSeed: "apple" }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  // undefined/null become "" (empty string) via ?? operator
  // Empty string sorts BEFORE "apple" in localeCompare
  // So seed-undefined and seed-null come first, seed-apple last
  assert.equal(result[0]?.id, "seed-undefined");
  assert.equal(result[1]?.id, "seed-null");
  assert.equal(result[2]?.id, "seed-apple");
});

test("sortTicketsForDeterministicDispatch: full deterministic ordering with all factors", () => {
  const tickets = [
    createMockTicket({ id: "t1", priority: "low", criticalPathRank: 1, riskClass: "low", schedulerSeed: "aaa" }),
    createMockTicket({ id: "t2", priority: "critical", criticalPathRank: 0, riskClass: "low", schedulerSeed: "aaa" }),
    createMockTicket({ id: "t3", priority: "high", criticalPathRank: 10, riskClass: "low", schedulerSeed: "aaa" }),
    createMockTicket({ id: "t4", priority: "critical", criticalPathRank: 10, riskClass: "low", schedulerSeed: "aaa" }),
    createMockTicket({ id: "t5", priority: "critical", criticalPathRank: 10, riskClass: "high", schedulerSeed: "aaa" }),
  ];

  const result = sortTicketsForDeterministicDispatch(tickets);

  // Primary sort: priority (critical > urgent > high > normal > low)
  // Secondary sort: criticalPathRank (higher first)
  // Tertiary sort: riskClass (higher risk sorts first due to rightRisk - leftRisk)
  // 1. t5: critical, rank=10, high risk (wins tertiary sort over t4)
  // 2. t4: critical, rank=10, low risk
  // 3. t2: critical, rank=0 (same priority as t4/t5 but lower rank)
  // 4. t3: high, rank=10
  // 5. t1: low, rank=1
  assert.equal(result[0]?.id, "t5");
  assert.equal(result[1]?.id, "t4");
  assert.equal(result[2]?.id, "t2");
  assert.equal(result[3]?.id, "t3");
  assert.equal(result[4]?.id, "t1");
});

test("sortTicketsForDeterministicDispatch: does not mutate original array", () => {
  const tickets = [
    createMockTicket({ id: "t1", priority: "low" }),
    createMockTicket({ id: "t2", priority: "high" }),
  ];
  const original = [...tickets];

  sortTicketsForDeterministicDispatch(tickets);

  assert.deepEqual(tickets, original);
});

// ---------------------------------------------------------------------------
// interleaveTicketsByTenant tests
// ---------------------------------------------------------------------------

test("interleaveTicketsByTenant: empty array returns empty array", () => {
  const result = interleaveTicketsByTenant([]);
  assert.deepEqual(result, []);
});

test("interleaveTicketsByTenant: single ticket returns same ticket", () => {
  const ticket = createMockTicket({ id: "ticket-1", tenantId: "tenant-1" });
  const result = interleaveTicketsByTenant([ticket]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "ticket-1");
});

test("interleaveTicketsByTenant: single tenant returns tickets in original order", () => {
  const tickets = [
    createMockTicket({ id: "t1", tenantId: "tenant-1" }),
    createMockTicket({ id: "t2", tenantId: "tenant-1" }),
    createMockTicket({ id: "t3", tenantId: "tenant-1" }),
  ];

  const result = interleaveTicketsByTenant(tickets);

  // With single tenant and maxBurst=3, all tickets should be returned
  assert.equal(result.length, 3);
  // All should be from tenant-1
  assert.ok(result.every(t => t.tenantId === "tenant-1"));
});

test("interleaveTicketsByTenant: interleaves two tenants with default maxBurst=3", () => {
  const tickets = [
    createMockTicket({ id: "t1a", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1b", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1c", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1d", tenantId: "tenant-a" }),
    createMockTicket({ id: "t2a", tenantId: "tenant-b" }),
    createMockTicket({ id: "t2b", tenantId: "tenant-b" }),
  ];

  const result = interleaveTicketsByTenant(tickets);

  // With maxBurst=3, tenant-a should get 3 tickets, then tenant-b gets 2, then tenant-a gets 1
  // Pattern: t1a, t1b, t1c, t2a, t2b, t1d
  assert.equal(result[0]?.id, "t1a");
  assert.equal(result[1]?.id, "t1b");
  assert.equal(result[2]?.id, "t1c");
  assert.equal(result[3]?.id, "t2a");
  assert.equal(result[4]?.id, "t2b");
  assert.equal(result[5]?.id, "t1d");
});

test("interleaveTicketsByTenant: respects custom maxBurstPerTenant", () => {
  const tickets = [
    createMockTicket({ id: "t1a", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1b", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1c", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1d", tenantId: "tenant-a" }),
    createMockTicket({ id: "t2a", tenantId: "tenant-b" }),
    createMockTicket({ id: "t2b", tenantId: "tenant-b" }),
  ];

  const result = interleaveTicketsByTenant(tickets, 2);

  // With maxBurst=2: t1a, t1b, t2a, t2b, t1c, t1d
  assert.equal(result[0]?.id, "t1a");
  assert.equal(result[1]?.id, "t1b");
  assert.equal(result[2]?.id, "t2a");
  assert.equal(result[3]?.id, "t2b");
  assert.equal(result[4]?.id, "t1c");
  assert.equal(result[5]?.id, "t1d");
});

test("interleaveTicketsByTenant: handles maxBurstPerTenant=1 (round-robin)", () => {
  const tickets = [
    createMockTicket({ id: "t1a", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1b", tenantId: "tenant-a" }),
    createMockTicket({ id: "t2a", tenantId: "tenant-b" }),
  ];

  const result = interleaveTicketsByTenant(tickets, 1);

  // Round-robin: t1a, t2a, t1b
  assert.equal(result[0]?.id, "t1a");
  assert.equal(result[1]?.id, "t2a");
  assert.equal(result[2]?.id, "t1b");
});

test("interleaveTicketsByTenant: handles null/undefined tenantId as 'default'", () => {
  const tickets = [
    createMockTicket({ id: "t1", tenantId: "tenant-1" }),
    createMockTicket({ id: "t2", tenantId: null as unknown as string }),
    createMockTicket({ id: "t3", tenantId: "tenant-1" }),
    createMockTicket({ id: "t4", tenantId: undefined as unknown as string }),
  ];

  const result = interleaveTicketsByTenant(tickets);

  // null and undefined should be treated as "default" tenant
  assert.equal(result.length, 4);
});

test("interleaveTicketsByTenant: handles three tenants", () => {
  const tickets = [
    createMockTicket({ id: "t1a", tenantId: "tenant-a" }),
    createMockTicket({ id: "t1b", tenantId: "tenant-a" }),
    createMockTicket({ id: "t2a", tenantId: "tenant-b" }),
    createMockTicket({ id: "t3a", tenantId: "tenant-c" }),
    createMockTicket({ id: "t3b", tenantId: "tenant-c" }),
  ];

  const result = interleaveTicketsByTenant(tickets, 2);

  // With maxBurst=2: tenant-a(2), tenant-b(1), tenant-c(2), tenant-a(done), tenant-c(done), tenant-b(done)
  // Pattern: t1a, t1b, t2a, t3a, t3b
  assert.equal(result[0]?.id, "t1a");
  assert.equal(result[1]?.id, "t1b");
  assert.equal(result[2]?.id, "t2a");
  assert.equal(result[3]?.id, "t3a");
  assert.equal(result[4]?.id, "t3b");
});

test("interleaveTicketsByTenant: does not mutate original array", () => {
  const tickets = [
    createMockTicket({ id: "t1", tenantId: "tenant-1" }),
    createMockTicket({ id: "t2", tenantId: "tenant-2" }),
  ];
  const original = [...tickets];

  interleaveTicketsByTenant(tickets);

  assert.deepEqual(tickets, original);
});

// ---------------------------------------------------------------------------
// hashDispatchSeed tests
// ---------------------------------------------------------------------------

test("hashDispatchSeed: empty string returns 0", () => {
  const result = hashDispatchSeed("");
  assert.equal(result, 0);
});

test("hashDispatchSeed: same seed produces same hash", () => {
  const seed = "test-seed-123";
  const result1 = hashDispatchSeed(seed);
  const result2 = hashDispatchSeed(seed);
  assert.equal(result1, result2);
});

test("hashDispatchSeed: different seeds produce different hashes", () => {
  const hash1 = hashDispatchSeed("seed-a");
  const hash2 = hashDispatchSeed("seed-b");
  assert.notEqual(hash1, hash2);
});

test("hashDispatchSeed: returns non-negative integer", () => {
  const seeds = ["", "a", "abc", "longer-seed-string-with-many-characters", "special!@#$%^&*()chars"];
  for (const seed of seeds) {
    const hash = hashDispatchSeed(seed);
    assert.ok(Number.isInteger(hash), `Hash of "${seed}" should be integer`);
    assert.ok(hash >= 0, `Hash of "${seed}" should be non-negative`);
  }
});

test("hashDispatchSeed: hash is consistent and deterministic", () => {
  const seed = "deterministic-seed";
  const hashes: number[] = [];
  for (let i = 0; i < 100; i++) {
    hashes.push(hashDispatchSeed(seed));
  }
  // All hashes should be identical
  assert.ok(hashes.every(h => h === hashes[0]), "Hash should be consistent across calls");
});

test("hashDispatchSeed: longer strings produce different hashes", () => {
  const short = hashDispatchSeed("ab");
  const medium = hashDispatchSeed("abc");
  const long = hashDispatchSeed("abcd");
  assert.notEqual(short, medium);
  assert.notEqual(medium, long);
});

test("hashDispatchSeed: character order matters", () => {
  const hash1 = hashDispatchSeed("abc");
  const hash2 = hashDispatchSeed("cba");
  const hash3 = hashDispatchSeed("bac");
  assert.notEqual(hash1, hash2);
  assert.notEqual(hash2, hash3);
  assert.notEqual(hash1, hash3);
});

test("hashDispatchSeed: unicode characters handled", () => {
  const hash1 = hashDispatchSeed("seed");
  const hash2 = hashDispatchSeed("séed"); // 'séed' with accented e
  assert.notEqual(hash1, hash2);
});

test("hashDispatchSeed: numeric strings work", () => {
  const hash1 = hashDispatchSeed("123");
  const hash2 = hashDispatchSeed("321");
  const hash3 = hashDispatchSeed("1234");
  assert.ok(Number.isInteger(hash1));
  assert.ok(Number.isInteger(hash2));
  assert.ok(Number.isInteger(hash3));
  assert.notEqual(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

// ---------------------------------------------------------------------------
// Integration scenarios
// ---------------------------------------------------------------------------

test("sortTicketsForDeterministicDispatch + interleaveTicketsByTenant: fair tenant dispatch", () => {
  // Create tickets for two tenants with different priorities
  const tickets = [
    createMockTicket({ id: "t1-critical", tenantId: "tenant-a", priority: "critical", criticalPathRank: 10 }),
    createMockTicket({ id: "t2-normal", tenantId: "tenant-a", priority: "normal", criticalPathRank: 5 }),
    createMockTicket({ id: "t3-high", tenantId: "tenant-b", priority: "high", criticalPathRank: 8 }),
    createMockTicket({ id: "t4-low", tenantId: "tenant-b", priority: "low", criticalPathRank: 2 }),
  ];

  // First sort by deterministic dispatch rules
  const sorted = sortTicketsForDeterministicDispatch(tickets);

  // Then interleave by tenant for fair dispatch
  const interleaved = interleaveTicketsByTenant(sorted, 2);

  // Critical ticket should be first after sorting
  assert.equal(interleaved[0]?.id, "t1-critical");

  // But tenant-b high priority should still be in the mix
  const tenantBIds = interleaved.filter(t => t.tenantId === "tenant-b").map(t => t.id);
  assert.ok(tenantBIds.includes("t3-high"));
});
