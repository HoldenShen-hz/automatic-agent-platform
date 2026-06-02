/**
 * Unit tests for delegation repository
 *
 * Part of §26 storage layer implementation.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryDelegationRepository,
  InMemoryDelegationEventRepository,
  type CreateDelegationInput,
} from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/delegation-repository.js";

const defaultPermissions = {
  resources: ["workspace"],
  actions: ["tool:invoke"],
  constraints: {},
} as const;

test("InMemoryDelegationRepository creates delegation", async () => {
  const repo = new InMemoryDelegationRepository();

  const input: CreateDelegationInput = {
    parentAgentId: "agent-1",
    childAgentId: "agent-2",
    delegationChain: ["agent-1", "agent-2"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 2,
    expiresAt: "2026-05-01T00:00:00Z",
  };

  const delegation = await repo.create(input);

  assert.ok(delegation.delegationId);
  assert.match(delegation.delegationId, /^delegation_/);
  assert.equal(delegation.parentAgentId, "agent-1");
  assert.equal(delegation.childAgentId, "agent-2");
  assert.equal(delegation.status, "pending");
  assert.equal(delegation.depth, 2);
  assert.deepEqual(delegation.permissions.resources, ["workspace"]);
  assert.deepEqual(delegation.grantedPermissions.actions, ["tool:invoke"]);
});

test("InMemoryDelegationRepository finds by id", async () => {
  const repo = new InMemoryDelegationRepository();
  const created = await repo.create({
    parentAgentId: "parent",
    childAgentId: "child",
    delegationChain: ["parent", "child"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  const found = await repo.findById(created.delegationId);

  assert.ok(found);
  assert.equal(found?.parentAgentId, "parent");
});

test("InMemoryDelegationRepository finds by parent agent id", async () => {
  const repo = new InMemoryDelegationRepository();

  await repo.create({
    parentAgentId: "parent-1",
    childAgentId: "child-1",
    delegationChain: ["parent-1", "child-1"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });
  await repo.create({
    parentAgentId: "parent-1",
    childAgentId: "child-2",
    delegationChain: ["parent-1", "child-2"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  const delegations = await repo.findByParentAgentId("parent-1");

  assert.equal(delegations.length, 2);
});

test("InMemoryDelegationRepository updates status", async () => {
  const repo = new InMemoryDelegationRepository();
  const created = await repo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  await repo.updateStatus(created.delegationId, "active");

  const found = await repo.findById(created.delegationId);
  assert.equal(found?.status, "active");
});

test("InMemoryDelegationRepository completes delegation", async () => {
  const repo = new InMemoryDelegationRepository();
  const created = await repo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  await repo.complete(created.delegationId, "result-ref-123");

  const found = await repo.findById(created.delegationId);
  assert.equal(found?.status, "completed");
  assert.equal(found?.resultRef, "result-ref-123");
});

test("InMemoryDelegationRepository fails delegation", async () => {
  const repo = new InMemoryDelegationRepository();
  const created = await repo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  await repo.fail(created.delegationId, "error message");

  const found = await repo.findById(created.delegationId);
  assert.equal(found?.status, "failed");
});

test("InMemoryDelegationRepository finds expired delegations", async () => {
  const repo = new InMemoryDelegationRepository();
  const now = new Date().toISOString();

  // Create an expired delegation
  await repo.create({
    parentAgentId: "p1",
    childAgentId: "c1",
    delegationChain: ["p1", "c1"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
    expiresAt: "2020-01-01T00:00:00Z", // Expired
  });

  // Create an active delegation
  await repo.create({
    parentAgentId: "p2",
    childAgentId: "c2",
    delegationChain: ["p2", "c2"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
    expiresAt: "2099-01-01T00:00:00Z", // Not expired
  });

  const expired = await repo.findExpired(now);

  assert.equal(expired.length, 1);
  assert.equal(expired[0]!.parentAgentId, "p1");
});

test("InMemoryDelegationRepository deletes delegation", async () => {
  const repo = new InMemoryDelegationRepository();
  const created = await repo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  await repo.delete(created.delegationId);

  const found = await repo.findById(created.delegationId);
  assert.equal(found, null);
});

test("InMemoryDelegationEventRepository creates event", async () => {
  const repo = new InMemoryDelegationEventRepository();
  const delegationRepo = new InMemoryDelegationRepository();
  const delegation = await delegationRepo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  const event = await repo.create({
    delegationId: delegation.delegationId,
    eventType: "delegation:activated",
    payload: { activatedAt: new Date().toISOString() },
  });

  assert.ok(event.eventId);
  assert.match(event.eventId, /^delegation_event_/);
  assert.equal(event.delegationId, delegation.delegationId);
  assert.equal(event.eventType, "delegation:activated");
});

test("InMemoryDelegationEventRepository finds by delegation id", async () => {
  const repo = new InMemoryDelegationEventRepository();
  const delegationRepo = new InMemoryDelegationRepository();
  const delegation = await delegationRepo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  await repo.create({
    delegationId: delegation.delegationId,
    eventType: "event-1",
    payload: {},
  });
  await repo.create({
    delegationId: delegation.delegationId,
    eventType: "event-2",
    payload: {},
  });

  const events = await repo.findByDelegationId(delegation.delegationId);

  assert.equal(events.length, 2);
});

test("InMemoryDelegationEventRepository deletes by delegation id", async () => {
  const repo = new InMemoryDelegationEventRepository();
  const delegationRepo = new InMemoryDelegationRepository();
  const delegation = await delegationRepo.create({
    parentAgentId: "p",
    childAgentId: "c",
    delegationChain: ["p", "c"],
    permissions: defaultPermissions,
    grantedPermissions: defaultPermissions,
    depth: 1,
  });

  await repo.create({
    delegationId: delegation.delegationId,
    eventType: "event-1",
    payload: {},
  });

  await repo.deleteByDelegationId(delegation.delegationId);

  const events = await repo.findByDelegationId(delegation.delegationId);
  assert.equal(events.length, 0);
});
