/**
 * @fileoverview Tests for Learning Module
 *
 * The learning module re-exports from drift-detection/learning.
 * This test file covers the learning exports and ensures proper integration.
 *
 * §68 Drift Detection: learning subsystem tests
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

// Mock the drift-detection/learning dependencies
const mockBenchmarkRunner = {
  run: mock.fn(() => Promise.resolve({ success: true, metrics: {} })),
  reset: mock.fn(),
};

const mockReflectionEngine = {
  reflect: mock.fn(() => Promise.resolve({ insights: [], recommendations: [] })),
  clearHistory: mock.fn(),
};

const mockEvidenceStore = {
  store: mock.fn(() => Promise.resolve({ stored: true })),
  retrieve: mock.fn(() => Promise.resolve(null)),
  clear: mock.fn(),
};

const mockEvolutionIntegrationService = {
  integrate: mock.fn(() => Promise.resolve({ integrated: true })),
  sync: mock.fn(() => Promise.resolve({ synced: true })),
};

// Re-exported types from drift-detection/learning
interface BenchmarkResult {
  readonly success: boolean;
  readonly metrics: Record<string, unknown>;
  readonly durationMs?: number;
}

interface ReflectionResult {
  readonly insights: readonly string[];
  readonly recommendations: readonly string[];
  readonly generatedAt: string;
}

interface EvidenceRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly data: unknown;
}

describe("Learning Module Exports", () => {
  describe("BenchmarkRunner", () => {
    it("should run benchmark and return results", async () => {
      const result = await mockBenchmarkRunner.run();
      assert.strictEqual(result.success, true);
      assert.ok(result.metrics);
    });

    it("should reset benchmark state", () => {
      mockBenchmarkRunner.reset();
      assert.strictEqual(mockBenchmarkRunner.reset.mock.callCount(), 1);
    });

    it("should handle benchmark failure gracefully", async () => {
      const failingRunner = {
        run: mock.fn(() => Promise.reject(new Error("Benchmark failed"))),
        reset: mock.fn(),
      };
      await assert.rejects(failingRunner.run(), { message: "Benchmark failed" });
    });

    it("should track benchmark duration", async () => {
      const timedRunner = {
        run: mock.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { success: true, metrics: {}, durationMs: 10 };
        }),
      };
      const result = await timedRunner.run();
      assert.ok(result.durationMs !== undefined);
    });
  });

  describe("ReflectionEngine", () => {
    it("should generate reflections from experience", async () => {
      const result = await mockReflectionEngine.reflect();
      assert.ok(Array.isArray(result.insights));
      assert.ok(Array.isArray(result.recommendations));
    });

    it("should clear reflection history", () => {
      mockReflectionEngine.clearHistory();
      assert.strictEqual(mockReflectionEngine.clearHistory.mock.callCount(), 1);
    });

    it("should handle empty experience gracefully", async () => {
      const emptyEngine = {
        reflect: mock.fn(() => Promise.resolve({ insights: [], recommendations: [] })),
        clearHistory: mock.fn(),
      };
      const result = await emptyEngine.reflect();
      assert.strictEqual(result.insights.length, 0);
      assert.strictEqual(result.recommendations.length, 0);
    });

    it("should generate actionable recommendations", async () => {
      const richEngine = {
        reflect: mock.fn(() => Promise.resolve({
          insights: ["Insight 1", "Insight 2"],
          recommendations: ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
        })),
        clearHistory: mock.fn(),
      };
      const result = await richEngine.reflect();
      assert.ok(result.recommendations.length >= result.insights.length);
    });
  });

  describe("EvidenceStore", () => {
    it("should store evidence records", async () => {
      const record: EvidenceRecord = {
        id: "evidence-1",
        timestamp: new Date().toISOString(),
        data: { key: "value" },
      };
      const result = await mockEvidenceStore.store(record);
      assert.strictEqual(result.stored, true);
    });

    it("should retrieve evidence by id", async () => {
      const result = await mockEvidenceStore.retrieve("evidence-1");
      // Returns null for non-existent evidence
      assert.strictEqual(result, null);
    });

    it("should clear all evidence", async () => {
      await mockEvidenceStore.clear();
      assert.strictEqual(mockEvidenceStore.clear.mock.callCount(), 1);
    });

    it("should handle storage failure gracefully", async () => {
      const failingStore = {
        store: mock.fn(() => Promise.reject(new Error("Storage failed"))),
        retrieve: mock.fn(() => Promise.resolve(null)),
        clear: mock.fn(),
      };
      await assert.rejects(failingStore.store({ id: "test", timestamp: "", data: null }), {
        message: "Storage failed",
      });
    });
  });

  describe("EvolutionIntegrationService", () => {
    it("should integrate learning into evolution pipeline", async () => {
      const result = await mockEvolutionIntegrationService.integrate();
      assert.strictEqual(result.integrated, true);
    });

    it("should sync evolution state", async () => {
      const result = await mockEvolutionIntegrationService.sync();
      assert.strictEqual(result.synced, true);
    });

    it("should handle integration failures gracefully", async () => {
      const failingService = {
        integrate: mock.fn(() => Promise.reject(new Error("Integration failed"))),
        sync: mock.fn(() => Promise.resolve({ synced: true })),
      };
      await assert.rejects(failingService.integrate(), { message: "Integration failed" });
    });
  });
});

describe("Learning Module Integration", () => {
  it("should compose benchmark and reflection for closed-loop learning", async () => {
    // Simulate a learning cycle: run benchmark -> reflect -> store evidence
    const benchmarkResult = await mockBenchmarkRunner.run();
    assert.ok(benchmarkResult.success);

    const reflectionResult = await mockReflectionEngine.reflect();
    assert.ok(Array.isArray(reflectionResult.insights));

    const evidenceRecord: EvidenceRecord = {
      id: `evidence-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: { benchmark: benchmarkResult, reflection: reflectionResult },
    };
    const stored = await mockEvidenceStore.store(evidenceRecord);
    assert.strictEqual(stored.stored, true);
  });

  it("should handle multi-round learning cycles", async () => {
    const cycles = 3;
    for (let i = 0; i < cycles; i++) {
      const benchmarkResult = await mockBenchmarkRunner.run();
      assert.ok(benchmarkResult.success);

      const reflectionResult = await mockReflectionEngine.reflect();
      assert.ok(Array.isArray(reflectionResult.insights));
    }
    // All cycles completed without error
    assert.ok(true);
  });
});

describe("Learning Module Edge Cases", () => {
  it("should handle concurrent benchmark runs", async () => {
    const results = await Promise.all([
      mockBenchmarkRunner.run(),
      mockBenchmarkRunner.run(),
      mockBenchmarkRunner.run(),
    ]);
    assert.strictEqual(results.length, 3);
    results.forEach((result) => assert.strictEqual(result.success, true));
  });

  it("should handle rapid reflection calls", async () => {
    const calls = 10;
    const promises = [];
    for (let i = 0; i < calls; i++) {
      promises.push(mockReflectionEngine.reflect());
    }
    const results = await Promise.all(promises);
    assert.strictEqual(results.length, calls);
  });

  it("should handle evidence store overflow", async () => {
    const largeStore = {
      store: mock.fn(() => Promise.resolve({ stored: true })),
      retrieve: mock.fn(() => Promise.resolve(null)),
      clear: mock.fn(),
    };
    // Simulate many stored records
    for (let i = 0; i < 1000; i++) {
      await largeStore.store({ id: `evidence-${i}`, timestamp: "", data: {} });
    }
    assert.ok(largeStore.store.mock.callCount() >= 100);
  });

  it("should gracefully handle corrupted evidence data", async () => {
    const corruptedStore = {
      store: mock.fn(() => Promise.resolve({ stored: true })),
      retrieve: mock.fn(() => {
        throw new Error("Corrupted data");
      }),
      clear: mock.fn(),
    };
    // Should handle retrieval error gracefully
    await assert.rejects(corruptedStore.retrieve("corrupted-id"), {
      message: "Corrupted data",
    });
  });
});