/**
 * @fileoverview Unit tests for execution dispatch ordering functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  sortTicketsForDeterministicDispatch,
  interleaveTicketsByTenant,
  hashDispatchSeed,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-ordering.js";

import type { ExecutionTicketRecord } from "../../../../../src/platform/contracts/types/domain.js";

function makeTicket(overrides: Partial<ExecutionTicketRecord> = {}): ExecutionTicketRecord {
  return {
    id: "ticket_1",
    taskId: "task_1",
    executionId: "exec_1",
    status: "pending",
    priority: "normal",
    attempt: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as ExecutionTicketRecord;
}

test("sortTicketsForDeterministicDispatch sorts by priority descending", () => {
  const tickets = [
    makeTicket({ id: "1", priority: "low" }),
    makeTicket({ id: "2", priority: "critical" }),
    makeTicket({ id: "3", priority: "normal" }),
    makeTicket({ id: "4", priority: "urgent" }),
    makeTicket({ id: "5", priority: "high" }),
  ];

  const sorted = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "urgent");
  assert.equal(sorted[2]!.priority, "high");
  assert.equal(sorted[3]!.priority, "normal");
  assert.equal(sorted[4]!.priority, "low");
});

test("sortTicketsForDeterministicDispatch sorts by criticalPathRank within same priority", () => {
  const tickets = [
    makeTicket({ id: "ticket_1", priority: "normal", criticalPathRank: 1 }),
    makeTicket({ id: "ticket_2", priority: "normal", criticalPathRank: 3 }),
    makeTicket({ id: "ticket_3", priority: "normal", criticalPathRank: 2 }),
  ];

  const sorted = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(sorted[0]!.id, "ticket_2");
  assert.equal(sorted[1]!.id, "ticket_3");
  assert.equal(sorted[2]!.id, "ticket_1");
});

test("sortTicketsForDeterministicDispatch sorts by riskClass within same priority and rank", () => {
  const tickets = [
    makeTicket({ id: "ticket_1", priority: "normal", criticalPathRank: 0, riskClass: "low" }),
    makeTicket({ id: "ticket_2", priority: "normal", criticalPathRank: 0, riskClass: "critical" }),
    makeTicket({ id: "ticket_3", priority: "normal", criticalPathRank: 0, riskClass: "medium" }),
  ];

  const sorted = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(sorted[0]!.id, "ticket_2");
  assert.equal(sorted[1]!.id, "ticket_3");
  assert.equal(sorted[2]!.id, "ticket_1");
});

test("sortTicketsForDeterministicDispatch sorts by schedulerSeed as tiebreaker", () => {
  const tickets = [
    makeTicket({ id: "ticket_1", priority: "normal", criticalPathRank: 0, riskClass: "low", schedulerSeed: "z" }),
    makeTicket({ id: "ticket_2", priority: "normal", criticalPathRank: 0, riskClass: "low", schedulerSeed: "a" }),
    makeTicket({ id: "ticket_3", priority: "normal", criticalPathRank: 0, riskClass: "low", schedulerSeed: "m" }),
  ];

  const sorted = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(sorted[0]!.id, "ticket_2");
  assert.equal(sorted[1]!.id, "ticket_3");
  assert.equal(sorted[2]!.id, "ticket_1");
});

test("sortTicketsForDeterministicDispatch handles missing riskClass", () => {
  const tickets = [
    makeTicket({ id: "ticket_1", priority: "normal", criticalPathRank: 0, riskClass: undefined }),
    makeTicket({ id: "ticket_2", priority: "normal", criticalPathRank: 0, riskClass: "high" }),
  ];

  const sorted = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(sorted[0]!.id, "ticket_2");
  assert.equal(sorted[1]!.id, "ticket_1");
});

test("sortTicketsForDeterministicDispatch handles missing schedulerSeed", () => {
  const tickets = [
    makeTicket({ id: "ticket_1", priority: "normal", criticalPathRank: 0, schedulerSeed: undefined }),
    makeTicket({ id: "ticket_2", priority: "normal", criticalPathRank: 0, schedulerSeed: "abc" }),
  ];

  const sorted = sortTicketsForDeterministicDispatch(tickets);

  assert.equal(sorted[0]!.id, "ticket_2");
  assert.equal(sorted[1]!.id, "ticket_1");
});

test("sortTicketsForDeterministicDispatch does not mutate original array", () => {
  const tickets = [
    makeTicket({ id: "1", priority: "high" }),
    makeTicket({ id: "2", priority: "low" }),
  ];
  const original = [...tickets];

  sortTicketsForDeterministicDispatch(tickets);

  assert.deepEqual(tickets.map(t => t.id), original.map(t => t.id));
});

test("interleaveTicketsByTenant distributes tickets across tenants", () => {
  const tickets = [
    makeTicket({ id: "1", tenantId: "tenant_a" }),
    makeTicket({ id: "2", tenantId: "tenant_a" }),
    makeTicket({ id: "3", tenantId: "tenant_a" }),
    makeTicket({ id: "4", tenantId: "tenant_b" }),
    makeTicket({ id: "5", tenantId: "tenant_b" }),
    makeTicket({ id: "6", tenantId: "tenant_c" }),
  ];

  const interleaved = interleaveTicketsByTenant(tickets, 2);

  assert.equal(interleaved.length, 6);
  const tenantAIds = interleaved.filter(t => t.tenantId === "tenant_a").map(t => t.id);
  const tenantBIds = interleaved.filter(t => t.tenantId === "tenant_b").map(t => t.id);
  const tenantCIds = interleaved.filter(t => t.tenantId === "tenant_c").map(t => t.id);
  assert.equal(tenantAIds.length, 3);
  assert.equal(tenantBIds.length, 2);
  assert.equal(tenantCIds.length, 1);
});

test("interleaveTicketsByTenant respects maxBurstPerTenant", () => {
  const tickets = [
    makeTicket({ id: "1", tenantId: "tenant_a" }),
    makeTicket({ id: "2", tenantId: "tenant_a" }),
    makeTicket({ id: "3", tenantId: "tenant_a" }),
    makeTicket({ id: "4", tenantId: "tenant_a" }),
  ];

  const interleaved = interleaveTicketsByTenant(tickets, 2);

  assert.equal(interleaved.length, 4);
});

test("interleaveTicketsByTenant handles single ticket", () => {
  const tickets = [makeTicket({ id: "1" })];

  const interleaved = interleaveTicketsByTenant(tickets);

  assert.deepEqual(interleaved, tickets);
});

test("interleaveTicketsByTenant handles empty array", () => {
  const interleaved = interleaveTicketsByTenant([]);

  assert.deepEqual(interleaved, []);
});

test("interleaveTicketsByTenant uses default tenant when tenantId missing", () => {
  const tickets = [
    makeTicket({ id: "1", tenantId: undefined }),
    makeTicket({ id: "2", tenantId: "tenant_a" }),
  ];

  const interleaved = interleaveTicketsByTenant(tickets);

  assert.equal(interleaved.length, 2);
});

test("hashDispatchSeed produces consistent hash for same input", () => {
  const seed = "test_dispatch_seed";

  const hash1 = hashDispatchSeed(seed);
  const hash2 = hashDispatchSeed(seed);

  assert.equal(hash1, hash2);
});

test("hashDispatchSeed produces different hashes for different seeds", () => {
  const hash1 = hashDispatchSeed("seed_one");
  const hash2 = hashDispatchSeed("seed_two");

  assert.notEqual(hash1, hash2);
});

test("hashDispatchSeed handles empty string", () => {
  const hash = hashDispatchSeed("");

  assert.equal(hash, 0);
});

test("hashDispatchSeed handles unicode characters", () => {
  const hash1 = hashDispatchSeed("test_seed");
  const hash2 = hashDispatchSeed("test_sééd");

  assert.notEqual(hash1, hash2);
});