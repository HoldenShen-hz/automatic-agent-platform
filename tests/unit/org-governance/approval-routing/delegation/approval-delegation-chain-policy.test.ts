/**
 * Unit tests for approval-routing/delegation/approval-delegation-chain-policy module
 *
 * @see src/org-governance/approval-routing/delegation/approval-delegation-chain-policy.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ApprovalDelegationChainPolicy,
  type ApprovalDelegationChain,
} from "../../../../../src/org-governance/approval-routing/delegation/approval-delegation-chain-policy.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeChain(overrides: Partial<ApprovalDelegationChain> = {}): ApprovalDelegationChain {
  return {
    chainId: "chain-1",
    delegateActorIds: [],
    createdAtMs: 1000,
    expiresAtMs: 2000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy evaluation - allowed cases
// ─────────────────────────────────────────────────────────────────────────────

test("evaluate returns allowed when chain is within max length and time", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2"],
    createdAtMs: 0,
    expiresAtMs: 500, // 500ms total wait, within 1000ms limit
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

test("evaluate returns allowed at exact max chain length", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2", "actor-3"], // exactly 3, within max of 3
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

test("evaluate returns allowed at exact max total wait time", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1"],
    createdAtMs: 0,
    expiresAtMs: 1000, // exactly 1000ms, within limit
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

test("evaluate returns allowed for empty delegation chain", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: [],
    createdAtMs: 0,
    expiresAtMs: 0,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

// ─────────────────────────────────────────────────────────────────────────────
// Policy evaluation - chain too long
// ─────────────────────────────────────────────────────────────────────────────

test("evaluate returns chain_too_long when chain exceeds max length by one", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2", "actor-3", "actor-4"], // 4 > max 3
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.chain_too_long");
});

test("evaluate returns chain_too_long when chain exceeds max length significantly", () => {
  const policy = new ApprovalDelegationChainPolicy(2, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2", "actor-3", "actor-4", "actor-5"],
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.chain_too_long");
});

test("evaluate returns chain_too_long even when total wait is within limit", () => {
  const policy = new ApprovalDelegationChainPolicy(2, 10000); // generous time limit
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2", "actor-3"], // exceeds length 2
    createdAtMs: 0,
    expiresAtMs: 1000, // well within 10000ms
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.chain_too_long");
});

test("evaluate chain length check takes precedence over time check", () => {
  const policy = new ApprovalDelegationChainPolicy(2, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2", "actor-3"], // exceeds length
    createdAtMs: 0,
    expiresAtMs: 2000, // also exceeds time
  });

  const decision = policy.evaluate(chain);

  // Length is checked first, so we get chain_too_long not total_wait_exceeded
  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.chain_too_long");
});

// ─────────────────────────────────────────────────────────────────────────────
// Policy evaluation - total wait exceeded
// ─────────────────────────────────────────────────────────────────────────────

test("evaluate returns total_wait_exceeded when time window exceeds limit", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1"],
    createdAtMs: 0,
    expiresAtMs: 2000, // 2000ms > 1000ms limit
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.total_wait_exceeded");
});

test("evaluate returns total_wait_exceeded when time window significantly exceeds limit", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1"],
    createdAtMs: 0,
    expiresAtMs: 10000, // 10x the limit
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.total_wait_exceeded");
});

test("evaluate returns total_wait_exceeded even when chain is short", () => {
  const policy = new ApprovalDelegationChainPolicy(5, 500);
  const chain = makeChain({
    delegateActorIds: ["actor-1"], // short chain, within length limit
    createdAtMs: 0,
    expiresAtMs: 1000, // but exceeds time limit
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.total_wait_exceeded");
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-delegation behavior
// ─────────────────────────────────────────────────────────────────────────────

test("evaluate does not prevent single-actor chain (self-delegation check not implemented)", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1"],
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  // Current implementation has no self-delegation check
  // This test documents the current behavior (allows single actor)
  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

test("evaluate does not detect duplicate actors in chain (self-delegation check not implemented)", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-1", "actor-1"], // same actor repeated
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  // Current implementation does not check for duplicates
  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-org delegation rules
// ─────────────────────────────────────────────────────────────────────────────

test("evaluate does not validate org boundaries (cross-org check not implemented)", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 1000);
  const chain = makeChain({
    chainId: "chain-cross-org",
    delegateActorIds: ["org-A-actor-1", "org-B-actor-2", "org-C-actor-3"],
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  // Current implementation has no cross-org validation
  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

test("evaluate treats actors as opaque strings without org context", () => {
  const policy = new ApprovalDelegationChainPolicy(2, 1000);
  const chain = makeChain({
    delegateActorIds: [
      "alice@company.com",
      "bob@subsidiary.com",
      "charlie@partner.com",
    ],
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  // No special handling for org-prefixed actor IDs
  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false); // chain too long (3 > 2)
  assert.equal(decision.reasonCode, "approval_delegation.chain_too_long");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases and boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

test("evaluate handles max chain length of 1", () => {
  const policy = new ApprovalDelegationChainPolicy(1, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1"], // exactly at limit
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
});

test("evaluate rejects chain with single actor when max is 0", () => {
  const policy = new ApprovalDelegationChainPolicy(0, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1"], // exceeds 0
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.chain_too_long");
});

test("evaluate handles zero max total wait time", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 0);
  const chain = makeChain({
    delegateActorIds: [],
    createdAtMs: 0,
    expiresAtMs: 0, // exactly 0
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
});

test("evaluate rejects any non-zero wait when max is 0", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 0);
  const chain = makeChain({
    delegateActorIds: [],
    createdAtMs: 0,
    expiresAtMs: 1, // any positive value exceeds 0
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "approval_delegation.total_wait_exceeded");
});

test("evaluate uses configured maxDelegationChainLength from constructor", () => {
  const policy = new ApprovalDelegationChainPolicy(5, 1000);
  const chain = makeChain({
    delegateActorIds: ["actor-1", "actor-2", "actor-3", "actor-4", "actor-5"], // 5 actors
    createdAtMs: 0,
    expiresAtMs: 500,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
});

test("evaluate uses configured maxTotalApprovalWaitMs from constructor", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 5000);
  const chain = makeChain({
    delegateActorIds: [],
    createdAtMs: 0,
    expiresAtMs: 4999, // just under 5000
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
});

test("evaluate handles large actor ID arrays within limits", () => {
  const policy = new ApprovalDelegationChainPolicy(100, 10000);
  const chain = makeChain({
    delegateActorIds: Array.from({ length: 50 }, (_, i) => `actor-${i}`),
    createdAtMs: 0,
    expiresAtMs: 5000,
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "approval_delegation.allowed");
});

test("evaluate handles very large time windows within limits", () => {
  const policy = new ApprovalDelegationChainPolicy(3, 86400000); // 24 hours in ms
  const chain = makeChain({
    delegateActorIds: ["actor-1"],
    createdAtMs: 0,
    expiresAtMs: 43200000, // 12 hours
  });

  const decision = policy.evaluate(chain);

  assert.equal(decision.allowed, true);
});