import assert from "node:assert/strict";
import test from "node:test";

import {
  CostEstimationService,
  type CostEstimate,
  type CostEstimationConfig,
} from "../../../../src/scale-ecosystem/billing/cost-estimation-service.js";

function createMockDb() {
  return {
    connection: {
      prepare: () => ({
        get: () => null,
      }),
    },
  };
}

test("CostEstimationService estimate returns CostEstimate type", () => {
  const service = new CostEstimationService(createMockDb() as any);

  const estimate = service.estimate();

  assert.equal(typeof estimate.estimatedCostUsd, "number");
  assert.equal(typeof estimate.confidence, "string");
  assert.equal(typeof estimate.sampleCount, "number");
  assert.ok(estimate.divisionId === null || typeof estimate.divisionId === "string");
  assert.ok(["division_avg", "global_avg", "default"].includes(estimate.basedOn));
});

test("CostEstimationService estimate with division returns divisionId", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.20, sample_count: 30 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate("engineering");

  assert.equal(estimate.divisionId, "engineering");
});

test("CostEstimationService estimate without division returns null divisionId", () => {
  const service = new CostEstimationService(createMockDb() as any);

  const estimate = service.estimate();

  assert.equal(estimate.divisionId, null);
});

test("CostEstimationService estimate uses provided divisionId on fallback", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = (sql: string) => ({
    get: () => {
      if (sql.includes("division_id")) return null;
      return { avg_cost: 0.15, sample_count: 20 };
    },
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate("unknown_division");

  assert.equal(estimate.divisionId, null); // falls back to global
  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService confidence high threshold is configurable", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 30 }),
  });

  const config: CostEstimationConfig = {
    highConfidenceThreshold: 100,
    mediumConfidenceThreshold: 50,
    defaultCostUsd: 0.05,
  };

  const service = new CostEstimationService(mockDb as any, config);
  const estimate = service.estimate();

  // With 30 samples and high threshold of 100, should be "medium"
  assert.equal(estimate.confidence, "medium");
});

test("CostEstimationService confidence medium threshold is configurable", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 25 }),
  });

  const config: CostEstimationConfig = {
    highConfidenceThreshold: 100,
    mediumConfidenceThreshold: 30,
    defaultCostUsd: 0.05,
  };

  const service = new CostEstimationService(mockDb as any, config);
  const estimate = service.estimate();

  // With 25 samples and medium threshold of 30, should be "low"
  assert.equal(estimate.confidence, "low");
});

test("CostEstimationService confidence low when at boundary", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 4 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.confidence, "low");
});

test("CostEstimationService confidence medium at lower boundary", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 5 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.confidence, "medium");
});

test("CostEstimationService confidence high at high boundary", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 20 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.confidence, "high");
});

test("CostEstimationService confidence just below high boundary", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 19 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.confidence, "medium");
});

test("CostEstimationService uses zero default cost when configured", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
  });

  const config: CostEstimationConfig = {
    defaultCostUsd: 0,
  };

  const service = new CostEstimationService(mockDb as any, config);
  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0);
});

test("CostEstimationService uses large default cost when configured", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
  });

  const config: CostEstimationConfig = {
    defaultCostUsd: 999.99,
  };

  const service = new CostEstimationService(mockDb as any, config);
  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 999.99);
});

test("CostEstimationService rounds to 4 decimal places", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.123456789012345, sample_count: 100 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.1235);
});

test("CostEstimationService does not round up beyond 4 decimals", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.9999999, sample_count: 100 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 1.0);
});

test("CostEstimationService handles very small avg_cost", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.00001, sample_count: 50 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.0);
  assert.equal(estimate.basedOn, "division_avg");
});

test("CostEstimationService null avg_cost triggers fallback to global", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = (sql: string) => ({
    get: () => {
      if (sql.includes("division_id")) return { avg_cost: null, sample_count: 0 };
      return { avg_cost: 0.10, sample_count: 50 };
    },
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate("division_null_avg");

  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService null avg_cost in global triggers default", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: null, sample_count: 0 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
  assert.equal(estimate.estimatedCostUsd, 0.05);
});

test("CostEstimationService zero sample_count triggers fallback", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 0 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
});

test("CostEstimationService undefined result from prepare triggers default", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => undefined,
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
});

test("CostEstimationService zero cost_usd in query is filtered out", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0, sample_count: 0 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
});

test("CostEstimationService division avg_cost zero triggers fallback", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = (sql: string) => ({
    get: () => {
      if (sql.includes("division_id")) return { avg_cost: 0, sample_count: 10 };
      return { avg_cost: 0.12, sample_count: 50 };
    },
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate("division_zero_avg");

  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService empty string divisionId treated as no division", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.08, sample_count: 30 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate("");

  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService undefined divisionId uses global", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.09, sample_count: 40 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate(undefined);

  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService exact high confidence boundary", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.30, sample_count: 20 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.confidence, "high");
});

test("CostEstimationService CostEstimate can be created directly", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.1234,
    confidence: "high",
    sampleCount: 100,
    divisionId: "test_division",
    basedOn: "division_avg",
  };

  assert.equal(estimate.estimatedCostUsd, 0.1234);
  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.sampleCount, 100);
  assert.equal(estimate.divisionId, "test_division");
  assert.equal(estimate.basedOn, "division_avg");
});

test("CostEstimationService CostEstimationConfig can be created directly", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 50,
    mediumConfidenceThreshold: 10,
    defaultCostUsd: 0.25,
  };

  assert.equal(config.highConfidenceThreshold, 50);
  assert.equal(config.mediumConfidenceThreshold, 10);
  assert.equal(config.defaultCostUsd, 0.25);
});

test("CostEstimationService config defaults are applied", () => {
  const service = new CostEstimationService(createMockDb() as any);
  const estimate = service.estimate();

  // Default config: high=20, medium=5, defaultCost=0.05
  assert.equal(estimate.estimatedCostUsd, 0.05);
});

test("CostEstimationService partial config preserves defaults", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
  });

  // Only specify defaultCostUsd
  const config: CostEstimationConfig = {
    defaultCostUsd: 0.10,
  };

  const service = new CostEstimationService(mockDb as any, config);
  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.10);
  assert.equal(estimate.confidence, "default"); // Should still use default confidence
});

test("CostEstimationService with division and custom config", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.18, sample_count: 15 }),
  });

  const config: CostEstimationConfig = {
    highConfidenceThreshold: 50,
    mediumConfidenceThreshold: 20,
    defaultCostUsd: 0.05,
  };

  const service = new CostEstimationService(mockDb as any, config);
  const estimate = service.estimate("custom_div");

  // 15 samples with threshold 20 should be "low"
  assert.equal(estimate.confidence, "low");
  assert.equal(estimate.estimatedCostUsd, 0.18);
  assert.equal(estimate.basedOn, "division_avg");
  assert.equal(estimate.divisionId, "custom_div");
});

test("CostEstimationService sampleCount is correctly reported", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.22, sample_count: 77 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.sampleCount, 77);
});

test("CostEstimationService basedOn is division_avg when division data used", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.25, sample_count: 30 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate("some_division");

  assert.equal(estimate.basedOn, "division_avg");
});

test("CostEstimationService basedOn is global_avg when fallback used", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({ avg_cost: 0.15, sample_count: 25 }),
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimationService basedOn is default when no data", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
});

test("CostEstimationService multiple calls return independent estimates", () => {
  const mockDb = createMockDb();
  let callCount = 0;
  mockDb.connection.prepare = () => ({
    get: () => {
      callCount++;
      return { avg_cost: 0.10 + callCount * 0.01, sample_count: 20 };
    },
  });

  const service = new CostEstimationService(mockDb as any);
  const estimate1 = service.estimate("div1");
  const estimate2 = service.estimate("div2");

  assert.notEqual(estimate1.estimatedCostUsd, estimate2.estimatedCostUsd);
});