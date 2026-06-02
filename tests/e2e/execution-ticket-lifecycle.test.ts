/**
 * E2E Execution Ticket Lifecycle Tests
 *
 * Tests execution ticket lifecycle - ticket creation, claiming, and release.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-ticket.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return { workspace, db, store };
}

test("E2E: execution ticket can be created", () => {
  const h = createE2eHarness("e2e-ticket-create-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const now = nowIso();

    // Create task first
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Ticket test task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert execution ticket
    h.db.transaction(() => {
      h.store.insertExecutionTicket({
        id: ticketId,
        taskId,
        executionId,
        status: "pending",
        priority: "normal",
        queueName: "default",
        requiredCapabilitiesJson: JSON.stringify([]),
        dispatchAfter: null,
        attempt: 1,
        assignedWorkerId: null,
        leaseId: null,
        claimedAt: null,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const ticket = h.store.getExecutionTicket(ticketId);
    assert.ok(ticket, "Ticket should be created");
    assert.equal(ticket?.id, ticketId, "Ticket ID should match");
    assert.equal(ticket?.status, "pending", "Ticket should be pending");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution ticket can transition to claimed", () => {
  const h = createE2eHarness("e2e-ticket-claim-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");
    const now = nowIso();

    // Create task
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Ticket claim test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert ticket
    h.db.transaction(() => {
      h.store.insertExecutionTicket({
        id: ticketId,
        taskId,
        executionId,
        divisionId: "general-ops",
        status: "pending",
        priority: "normal",
        queueName: "default",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
    });

    // Claim ticket
    h.db.transaction(() => {
      h.store.claimExecutionTicket({
        ticketId,
        assignedWorkerId: workerId,
        leaseId: newId("lease"),
        claimedAt: new Date(Date.now() + 30000).toISOString(),
      });
    });

    const ticket = h.store.getExecutionTicket(ticketId);
    assert.ok(ticket, "Ticket should exist after claim");
    assert.equal(ticket?.status, "claimed", "Ticket should be claimed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution ticket can be consumed", () => {
  const h = createE2eHarness("e2e-ticket-consume-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");
    const now = nowIso();

    // Create task
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Ticket consume test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert and claim ticket
    h.db.transaction(() => {
      h.store.insertExecutionTicket({
        id: ticketId,
        taskId,
        executionId,
        status: "pending",
        priority: "normal",
        queueName: "default",
        requiredCapabilitiesJson: JSON.stringify([]),
        dispatchAfter: null,
        attempt: 1,
        assignedWorkerId: null,
        leaseId: null,
        claimedAt: null,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    h.db.transaction(() => {
      h.store.claimExecutionTicket({
        ticketId,
        assignedWorkerId: workerId,
        leaseId: newId("lease"),
        claimedAt: new Date(Date.now() + 30000).toISOString(),
      });
    });

    // Consume ticket
    h.db.transaction(() => {
      h.store.consumeExecutionTicket(ticketId, nowIso());
    });

    const ticket = h.store.getExecutionTicket(ticketId);
    assert.ok(ticket, "Ticket should exist after consume");
    assert.equal(ticket?.status, "consumed", "Ticket should be consumed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: multiple tickets can exist for different tasks", () => {
  const h = createE2eHarness("e2e-ticket-multi-");

  try {
    const tickets: string[] = [];
    const now = nowIso();

    // Create multiple tasks with tickets
    for (let i = 0; i < 5; i++) {
      const taskId = newId("task");
      const ticketId = newId("ticket");
      tickets.push(ticketId);

      h.db.transaction(() => {
        h.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Multi ticket test ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

        h.store.insertExecutionTicket({
          id: ticketId,
          taskId,
          executionId: newId("exec"),
          status: "pending",
          priority: "normal",
          queueName: "default",
          requiredCapabilitiesJson: JSON.stringify([]),
          dispatchAfter: null,
          attempt: 1,
          assignedWorkerId: null,
          leaseId: null,
          claimedAt: null,
          consumedAt: null,
          invalidatedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    // Verify all tickets exist
    for (const ticketId of tickets) {
      const ticket = h.store.getExecutionTicket(ticketId);
      assert.ok(ticket, "Ticket should exist");
      assert.equal(ticket?.status, "pending", "Ticket should be pending");
    }
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: ticket status transitions work correctly", () => {
  const h = createE2eHarness("e2e-ticket-status-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");
    const now = nowIso();

    // Create task
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Status transition test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert ticket as pending
    h.db.transaction(() => {
      h.store.insertExecutionTicket({
        id: ticketId,
        taskId,
        executionId,
        status: "pending",
        priority: "normal",
        queueName: "default",
        requiredCapabilitiesJson: JSON.stringify([]),
        dispatchAfter: null,
        attempt: 1,
        assignedWorkerId: null,
        leaseId: null,
        claimedAt: null,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    let ticket = h.store.getExecutionTicket(ticketId);
    assert.equal(ticket?.status, "pending", "Initial status should be pending");

    // Claim ticket
    h.db.transaction(() => {
      h.store.claimExecutionTicket({
        ticketId,
        assignedWorkerId: workerId,
        leaseId: newId("lease"),
        claimedAt: new Date(Date.now() + 30000).toISOString(),
      });
    });

    ticket = h.store.getExecutionTicket(ticketId);
    assert.equal(ticket?.status, "claimed", "Status should be claimed after claim");

    // Cancel ticket
    h.db.transaction(() => {
      h.store.invalidateExecutionTicket(ticketId, nowIso());
    });

    ticket = h.store.getExecutionTicket(ticketId);
    assert.equal(ticket?.status, "cancelled", "Status should be cancelled");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
