import * as assert from "node:assert/strict";
import * as test from "node:test";

import {
  CostEstimationService,
  type CostEstimate,
  type CostEstimationConfig,
} from "../../../../src/scale-ecosystem/billing/cost-estimation-service.js";

// Mock database
function createMockDb() {
  return {
    connection: {
      prepare: (_sql?: string) => ({
        get: () => null,
      }),
    },
  };
}

test("CostEstimationService estimates with default config", () => {
  const service = new CostEstimationService(createMockDb() as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "default");
  assert.equal(estimate.sampleCount, 0);
  assert.equal(estimate.basedOn, "default");
  assert.ok(estimate.estimatedCostUsd >= 0);
});

test("CostEstimationService uses default cost when no data", () => {
  const service = new CostEstimationService(createMockDb() as any);

  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.05);
});

test("CostEstimationService uses division-specific average when available", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.15, sample_count: 25 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate("engineering");

  assert.equal(estimate.basedOn, "division_avg");
  assert.equal(estimate.divisionId, "engineering");
  assert.equal(estimate.estimatedCostUsd, 0.15);
  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.sampleCount, 25);
});

test("CostEstimationService falls back to global average when division has no data", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = (sql: string) => ({
    get: () => {
      if (sql.includes("division_id")) {
        return null; // No division data
      }
      return { avg_cost: 0.10, sample_count: 50 };
    },
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate("unknown_division");

  assert.equal(estimate.basedOn, "global_avg");
  assert.equal(estimate.divisionId, null);
  assert.equal(estimate.estimatedCostUsd, 0.10);
});

test("CostEstimationService falls back to default when no data at all", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
  assert.equal(estimate.estimatedCostUsd, 0.05);
});

test("CostEstimationService confidence is high with 20+ samples", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 100 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "high");
});

test("CostEstimationService confidence is medium with 5-19 samples", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 10 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "medium");
});

test("CostEstimationService confidence is low with 1-4 samples", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 3 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "low");
});

test("CostEstimationService uses custom default cost", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
  });

  const config: CostEstimationConfig = {
    defaultCostUsd: 0.10,
  };

  const service = new CostEstimationService(mockDb as any, config);

  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.10);
});

test("CostEstimationService uses custom confidence thresholds", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 8 }),
  });

  const config: CostEstimationConfig = {
    highConfidenceThreshold: 50,
    mediumConfidenceThreshold: 20,
    defaultCostUsd: 0.05,
  };

  const service = new CostEstimationService(mockDb as any, config);

  const estimate = service.estimate();

  // With 8 samples and medium threshold of 20, it should be "low"
  assert.equal(estimate.confidence, "low");
});

test("CostEstimationService rounds estimated cost to 4 decimal places", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.123456789, sample_count: 100 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.1235);
});

test("CostEstimationService estimate without division returns null divisionId", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.10, sample_count: 50 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.divisionId, null);
});

test("CostEstimationService estimate with null divisionId uses global", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.08, sample_count: 30 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate(null);

  assert.equal(estimate.basedOn, "global_avg");
  assert.equal(estimate.divisionId, null);
});

test("CostEstimationService filters out zero-cost events", () => {
  const mockDb = createMockDb();
  let callCount = 0;
  mockDb.connection.prepare = (sql: string) => ({
    get: () => {
      callCount++;
      // Simulate division-specific query returning zero-cost data
      if (sql.includes("division_id") && callCount === 1) {
        return { avg_cost: 0, sample_count: 0 };
      }
      return { avg_cost: 0.12, sample_count: 15 };
    },
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate("division_with_zero_avg");

  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService CostEstimate type is correctly structured", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.25,
    confidence: "high",
    sampleCount: 100,
    divisionId: "engineering",
    basedOn: "division_avg",
  };

  assert.equal(estimate.estimatedCostUsd, 0.25);
  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.sampleCount, 100);
  assert.equal(estimate.divisionId, "engineering");
  assert.equal(estimate.basedOn, "division_avg");
});

test("CostEstimationService CostEstimationConfig type is correctly structured", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 30,
    mediumConfidenceThreshold: 10,
    defaultCostUsd: 0.15,
  };

  assert.equal(config.highConfidenceThreshold, 30);
  assert.equal(config.mediumConfidenceThreshold, 10);
  assert.equal(config.defaultCostUsd, 0.15);
});

test("CostEstimationService handles undefined avg_cost", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: null, sample_count: 0 }),
  });

  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
});
