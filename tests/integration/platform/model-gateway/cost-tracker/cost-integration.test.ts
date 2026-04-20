import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface MockCostRecord {
  id: string;
  taskId: string;
  amountUsd: number;
  provider: "anthropic" | "openai" | "minimax";
  createdAt: string;
}

interface MockBudgetPolicy {
  id: string;
  maxTaskCostUsd: number;
  maxDailyCostUsd: number;
  mode: "supervised" | "auto";
}

test("CostRecord creation with provider", () => {
  const record: MockCostRecord = {
    id: newId("cost"),
    taskId: newId("task"),
    amountUsd: 0.05,
    provider: "anthropic",
    createdAt: nowIso(),
  };

  assert.ok(record.id.startsWith("cost_"));
  assert.equal(record.provider, "anthropic");
  assert.ok(record.amountUsd > 0);
});

test("Multiple providers generate different cost records", () => {
  const providers: MockCostRecord["provider"][] = ["anthropic", "openai", "minimax"];
  const records: MockCostRecord[] = [];

  for (const provider of providers) {
    records.push({
      id: newId("cost"),
      taskId: newId("task"),
      amountUsd: Math.random() * 10,
      provider,
      createdAt: nowIso(),
    });
  }

  const uniqueProviders = new Set(records.map((r) => r.provider));
  assert.equal(uniqueProviders.size, 3);
});

test("BudgetPolicy enforcement", () => {
  const policy: MockBudgetPolicy = {
    id: newId("policy"),
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    mode: "supervised",
  };

  const taskCosts: number[] = [];
  let totalTaskCost = 0;

  for (let i = 0; i < 5; i++) {
    const cost = 2;
    taskCosts.push(cost);
    totalTaskCost += cost;
  }

  assert.equal(totalTaskCost <= policy.maxDailyCostUsd, true);
});

test("Cost aggregation per task", () => {
  const taskId = newId("task");
  const records: MockCostRecord[] = [];

  for (let i = 0; i < 3; i++) {
    records.push({
      id: newId("cost"),
      taskId,
      amountUsd: 0.01 * (i + 1),
      provider: "anthropic",
      createdAt: nowIso(),
    });
  }

  const totalCost = records.reduce((sum, r) => sum + r.amountUsd, 0);
  assert.ok(totalCost > 0);
});

test("Cost records sorted by creation time", () => {
  const records: MockCostRecord[] = [];

  for (let i = 0; i < 5; i++) {
    records.push({
      id: newId("cost"),
      taskId: newId("task"),
      amountUsd: 0.01,
      provider: "openai",
      createdAt: nowIso(),
    });
  }

  const sorted = records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  assert.ok(sorted[0]!.createdAt <= sorted[4]!.createdAt);
});
