/**
 * Unit tests for CostManagement module
 *
 * Tests the CostEstimationService exported from cost-management/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CostEstimationService } from "../../../src/scale-ecosystem/marketplace/cost-estimation-service.js";
import type { AuthoritativeSqlDatabase } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { SqliteConnection } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";

type ConnectionMock = Pick<SqliteConnection, "prepare">;

function createMockConnection(responses: Record<string, unknown>): ConnectionMock {
  return {
    prepare: (sql: string) => {
      const key = Object.keys(responses).find((k) => sql.includes(k));
      const value = key ? responses[key] : null;
      return {
        get: () => value,
        run: () => ({ changes: 1 }),
        all: () => [],
      };
    },
  } as unknown as ConnectionMock;
}

function createMockDb(responses: Record<string, unknown>): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T): T => fn(),
    connection: createMockConnection(responses),
  } as unknown as AuthoritativeSqlDatabase;
}

// ── estimate() with division data ───────────────────────────────────────────

test("CostEstimationService.estimate returns division average when division has data", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.15, sample_count: 25 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-a");

  assert.equal(result.estimatedCostUsd, 0.15);
  assert.equal(result.confidence, "high");
  assert.equal(result.sampleCount, 25);
  assert.equal(result.divisionId, "division-a");
  assert.equal(result.basedOn, "division_avg");
});

test("CostEstimationService.estimate uses division even when global also has data", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.25, sample_count: 10 },
    "cost_usd > 0": { avg_cost: 0.10, sample_count: 100 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-b");

  // Division avg takes precedence
  assert.equal(result.divisionId, "division-b");
  assert.equal(result.basedOn, "division_avg");
  assert.equal(result.estimatedCostUsd, 0.25);
});

test("CostEstimationService.estimate returns medium confidence for 5-19 samples", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.12, sample_count: 7 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-c");

  assert.equal(result.confidence, "medium");
  assert.equal(result.sampleCount, 7);
});

test("CostEstimationService.estimate returns low confidence for 1-4 samples", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.08, sample_count: 3 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-d");

  assert.equal(result.confidence, "low");
  assert.equal(result.sampleCount, 3);
});

test("CostEstimationService.estimate falls back to global when division has no data", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: null, sample_count: 0 },
    "cost_usd > 0": { avg_cost: 0.10, sample_count: 50 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-without-history");

  assert.equal(result.divisionId, null);
  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.estimatedCostUsd, 0.10);
  assert.equal(result.confidence, "high");
  assert.equal(result.sampleCount, 50);
});

// ── estimate() with no historical data ──────────────────────────────────────

test("CostEstimationService.estimate returns default when no historical data exists", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: null, sample_count: 0 },
    "cost_usd > 0": { avg_cost: null, sample_count: 0 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-new");

  assert.equal(result.estimatedCostUsd, 0.05);
  assert.equal(result.confidence, "default");
  assert.equal(result.sampleCount, 0);
  assert.equal(result.divisionId, null);
  assert.equal(result.basedOn, "default");
});

test("CostEstimationService.estimate returns default when divisionId is null and no global data", () => {
  const mockDb = createMockDb({
    "cost_usd > 0": { avg_cost: null, sample_count: 0 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate(null);

  assert.equal(result.basedOn, "default");
  assert.equal(result.confidence, "default");
  assert.equal(result.estimatedCostUsd, 0.05);
});

// ── estimate() without divisionId ───────────────────────────────────────────

test("CostEstimationService.estimate uses global average when no divisionId provided", () => {
  const mockDb = createMockDb({
    "cost_usd > 0": { avg_cost: 0.07, sample_count: 200 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate();

  assert.equal(result.divisionId, null);
  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.estimatedCostUsd, 0.07);
  assert.equal(result.sampleCount, 200);
  assert.equal(result.confidence, "high");
});

// ── estimate() with custom config ────────────────────────────────────────────

test("CostEstimationService respects custom highConfidenceThreshold", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.20, sample_count: 10 },
  });

  const service = new CostEstimationService(mockDb, {
    highConfidenceThreshold: 15,
    mediumConfidenceThreshold: 5,
    defaultCostUsd: 0.03,
  });

  const result = service.estimate("division-high");

  // 10 samples should be medium (below custom threshold of 15)
  assert.equal(result.confidence, "medium");
});

test("CostEstimationService respects custom mediumConfidenceThreshold", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.20, sample_count: 3 },
  });

  const service = new CostEstimationService(mockDb, {
    highConfidenceThreshold: 20,
    mediumConfidenceThreshold: 10,
    defaultCostUsd: 0.03,
  });

  const result = service.estimate("division-medium");

  // 3 samples should be low (below custom threshold of 10)
  assert.equal(result.confidence, "low");
});

test("CostEstimationService uses custom defaultCostUsd", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: null, sample_count: 0 },
    "cost_usd > 0": { avg_cost: null, sample_count: 0 },
  });

  const service = new CostEstimationService(mockDb, {
    highConfidenceThreshold: 20,
    mediumConfidenceThreshold: 5,
    defaultCostUsd: 0.25,
  });

  const result = service.estimate("division-no-data");

  assert.equal(result.estimatedCostUsd, 0.25);
  assert.equal(result.basedOn, "default");
  assert.equal(result.confidence, "default");
});

test("CostEstimationService uses all custom config options together", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: null, sample_count: 0 },
    "cost_usd > 0": { avg_cost: null, sample_count: 0 },
  });

  const service = new CostEstimationService(mockDb, {
    highConfidenceThreshold: 100,
    mediumConfidenceThreshold: 50,
    defaultCostUsd: 0.99,
  });

  const result = service.estimate("division-custom");

  assert.equal(result.estimatedCostUsd, 0.99);
  assert.equal(result.confidence, "default");
});

// ── CostEstimate roundtrip ───────────────────────────────────────────────────

test("CostEstimationService.estimate rounds cost to 4 decimal places", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: 0.123456789, sample_count: 30 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-precision");

  assert.equal(result.estimatedCostUsd, 0.1235);
});

test("CostEstimationService.estimate falls back to global when all division records have zero cost", () => {
  // When all cost_usd = 0, the WHERE cost_usd > 0 filter filters them all out
  // So AVG returns null (no rows to average), but COUNT(*) = 10 (all rows existed)
  const mockDb = createMockDb({
    "division_id": { avg_cost: null, sample_count: 10 },
    "cost_usd > 0": { avg_cost: 0.05, sample_count: 20 },
  });

  const service = new CostEstimationService(mockDb);
  const result = service.estimate("division-zero-cost");

  // Division avg_cost is null due to cost_usd > 0 filter, so falls back to global
  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.estimatedCostUsd, 0.05);
});

// ── Default configuration ───────────────────────────────────────────────────

test("CostEstimationService uses default config when none provided", () => {
  const mockDb = createMockDb({
    "division_id": { avg_cost: null, sample_count: 0 },
    "cost_usd > 0": { avg_cost: null, sample_count: 0 },
  });

  // Should not throw
  const service = new CostEstimationService(mockDb);

  const result = service.estimate();
  assert.equal(result.estimatedCostUsd, 0.05);
  assert.equal(result.confidence, "default");
});

test("CostEstimationService merges partial config with defaults", () => {
  const mockDb = createMockDb({
    "cost_usd > 0": { avg_cost: null, sample_count: 0 },
  });

  // Only override one option
  const service = new CostEstimationService(mockDb, {
    defaultCostUsd: 0.15,
  });

  const result = service.estimate();
  assert.equal(result.estimatedCostUsd, 0.15);
  // Other defaults should still apply
  assert.equal(result.confidence, "default");
});
