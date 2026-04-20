import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

// Mock reliability types for testing
interface MockReleaseRecord {
  id: string;
  bundleId: string;
  version: string;
  status: "recorded" | "validated" | "released" | "rolled_back";
  createdAt: string;
}

interface MockTaskCard {
  id: string;
  taskId: string;
  executionId: string;
  priority: number;
  status: "pending" | "in_progress" | "completed" | "failed";
}

test("ReleaseRecord creation with required fields", () => {
  const record: MockReleaseRecord = {
    id: newId("release"),
    bundleId: newId("bundle"),
    version: "1.0.0",
    status: "recorded",
    createdAt: nowIso(),
  };

  assert.ok(record.id.startsWith("release_"));
  assert.ok(record.bundleId.startsWith("bundle_"));
  assert.equal(record.status, "recorded");
  assert.ok(record.createdAt.length > 0);
});

test("TaskCard with priority ordering", () => {
  const cards: MockTaskCard[] = [
    { id: "1", taskId: "t1", executionId: "e1", priority: 3, status: "pending" },
    { id: "2", taskId: "t2", executionId: "e2", priority: 1, status: "pending" },
    { id: "3", taskId: "t3", executionId: "e3", priority: 2, status: "pending" },
  ];

  const sorted = cards.sort((a, b) => a.priority - b.priority);

  assert.equal(sorted[0]?.priority, 1);
  assert.equal(sorted[1]?.priority, 2);
  assert.equal(sorted[2]?.priority, 3);
});

test("TaskCard status transitions", () => {
  const card: MockTaskCard = {
    id: newId("card"),
    taskId: "task-1",
    executionId: "exec-1",
    priority: 1,
    status: "pending",
  };

  // Transition to in_progress
  card.status = "in_progress";
  assert.equal(card.status, "in_progress");

  // Transition to completed
  card.status = "completed";
  assert.equal(card.status, "completed");
});

test("ReleaseRecord status lifecycle", () => {
  const record: MockReleaseRecord = {
    id: newId("release"),
    bundleId: newId("bundle"),
    version: "2.0.0",
    status: "recorded",
    createdAt: nowIso(),
  };

  assert.equal(record.status, "recorded");

  record.status = "validated";
  assert.equal(record.status, "validated");

  record.status = "released";
  assert.equal(record.status, "released");

  record.status = "rolled_back";
  assert.equal(record.status, "rolled_back");
});

test("Multiple release records with unique IDs", () => {
  const records: MockReleaseRecord[] = [];

  for (let i = 0; i < 10; i++) {
    records.push({
      id: newId("release"),
      bundleId: newId("bundle"),
      version: `1.0.${i}`,
      status: "recorded",
      createdAt: nowIso(),
    });
  }

  const ids = records.map((r) => r.id);
  const uniqueIds = new Set(ids);

  assert.equal(uniqueIds.size, 10);
});

test("TaskCard grouping by status", () => {
  const cards: MockTaskCard[] = [
    { id: "1", taskId: "t1", executionId: "e1", priority: 1, status: "completed" },
    { id: "2", taskId: "t2", executionId: "e2", priority: 2, status: "pending" },
    { id: "3", taskId: "t3", executionId: "e3", priority: 3, status: "in_progress" },
    { id: "4", taskId: "t4", executionId: "e4", priority: 4, status: "completed" },
  ];

  const byStatus = cards.reduce((acc, card) => {
    if (!acc[card.status]) {
      acc[card.status] = [];
    }
    acc[card.status]!.push(card);
    return acc;
  }, {} as Record<string, MockTaskCard[]>);

  assert.equal(byStatus["completed"]?.length, 2);
  assert.equal(byStatus["pending"]?.length, 1);
  assert.equal(byStatus["in_progress"]?.length, 1);
  assert.equal(byStatus["failed"]?.length ?? 0, 0);
});

test("ReleaseRecord version sorting", () => {
  const records: MockReleaseRecord[] = [
    { id: "r1", bundleId: "b1", version: "1.0.0", status: "released", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "r2", bundleId: "b1", version: "1.0.1", status: "released", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "r3", bundleId: "b1", version: "1.1.0", status: "released", createdAt: "2026-01-03T00:00:00.000Z" },
    { id: "r4", bundleId: "b1", version: "2.0.0", status: "released", createdAt: "2026-01-04T00:00:00.000Z" },
  ];

  // Sort by createdAt (chronological)
  const sorted = records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  assert.equal(sorted[0]?.version, "1.0.0");
  assert.equal(sorted[1]?.version, "1.0.1");
  assert.equal(sorted[2]?.version, "1.1.0");
  assert.equal(sorted[3]?.version, "2.0.0");
});
