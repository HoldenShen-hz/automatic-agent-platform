/**
 * Tests for learning/rollout-repository.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { RolloutRecord } from "../../../../src/ops-maturity/drift-detection/rollout-manager.js";

/**
 * In-memory implementation for testing
 */
export class InMemoryRolloutRepository {
  private records: Map<string, RolloutRecord> = new Map();

  insert(record: RolloutRecord): void {
    this.records.set(record.proposalId, record);
  }

  get(proposalId: string): RolloutRecord | null {
    return this.records.get(proposalId) ?? null;
  }

  update(record: RolloutRecord): void {
    this.records.set(record.proposalId, record);
  }

  listAll(): RolloutRecord[] {
    return Array.from(this.records.values());
  }

  listByStatus(status: string): RolloutRecord[] {
    return Array.from(this.records.values()).filter((r) => r.status === status);
  }

  delete(proposalId: string): void {
    this.records.delete(proposalId);
  }
}

function createTestRecord(proposalId: string = "prop_1"): RolloutRecord {
  return {
    proposalId,
    stage: "canary",
    percentage: 5,
    startedAt: new Date().toISOString(),
    status: "running",
  };
}

test("InMemoryRolloutRepository insert adds record", () => {
  const repository = new InMemoryRolloutRepository();
  const record = createTestRecord();
  repository.insert(record);
  const retrieved = repository.get(record.proposalId);
  assert.strictEqual(retrieved?.proposalId, record.proposalId);
});

test("InMemoryRolloutRepository update modifies existing record", () => {
  const repository = new InMemoryRolloutRepository();
  const record = createTestRecord();
  repository.insert(record);

  const updated: RolloutRecord = {
    ...record,
    status: "succeeded",
    completedAt: new Date().toISOString(),
  };
  repository.update(updated);

  const retrieved = repository.get(record.proposalId);
  assert.strictEqual(retrieved?.status, "succeeded");
  assert.ok(retrieved?.completedAt);
});

test("InMemoryRolloutRepository get returns null for non-existent record", () => {
  const repository = new InMemoryRolloutRepository();
  const record = repository.get("non_existent");
  assert.strictEqual(record, null);
});

test("InMemoryRolloutRepository get returns inserted record by proposal id", () => {
  const repository = new InMemoryRolloutRepository();
  const record = createTestRecord("prop_2");
  repository.insert(record);
  const retrieved = repository.get("prop_2");
  assert.strictEqual(retrieved?.proposalId, "prop_2");
});

test("InMemoryRolloutRepository listAll returns empty array when no records", () => {
  const repository = new InMemoryRolloutRepository();
  const records = repository.listAll();
  assert.strictEqual(records.length, 0);
});

test("InMemoryRolloutRepository listAll returns all inserted records", () => {
  const repository = new InMemoryRolloutRepository();
  repository.insert(createTestRecord("prop_1"));
  repository.insert(createTestRecord("prop_2"));
  repository.insert(createTestRecord("prop_3"));

  const records = repository.listAll();
  assert.strictEqual(records.length, 3);
});

test("InMemoryRolloutRepository listByStatus returns only records with matching status", () => {
  const repository = new InMemoryRolloutRepository();
  const record1 = createTestRecord("prop_1");
  const record2 = createTestRecord("prop_2");
  const record3 = { ...createTestRecord("prop_3"), status: "succeeded" as const };

  repository.insert(record1);
  repository.insert(record2);
  repository.insert(record3);

  const running = repository.listByStatus("running");
  assert.strictEqual(running.length, 2);

  const succeeded = repository.listByStatus("succeeded");
  assert.strictEqual(succeeded.length, 1);
});

test("InMemoryRolloutRepository delete removes record by proposal id", () => {
  const repository = new InMemoryRolloutRepository();
  const record = createTestRecord("prop_1");
  repository.insert(record);
  repository.delete("prop_1");

  const retrieved = repository.get("prop_1");
  assert.strictEqual(retrieved, null);
});