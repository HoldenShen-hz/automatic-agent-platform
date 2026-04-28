import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CostOptimizationService, type CostAttributionRecord } from '../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js';
import { aggregateCostAttribution } from '../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js';
import { buildCostOptimizationRecommendation, prioritizeCostOptimizationRecommendations } from '../../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js';
import { simulateCostOptimization, simulateScenarioSavings } from '../../../../src/ops-maturity/cost-optimizer/simulator/index.js';

function makeCostRecord(overrides: Partial<CostAttributionRecord> = {}): CostAttributionRecord {
  return {
    subjectType: 'task',
    subjectId: 'task-001',
    costType: 'llm',
    amountUsd: 0.10,
    llmCostUsd: 0.08,
    toolCostUsd: 0.02,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: 'dec-001',
    capturedAt: '2026-04-29T00:00:00Z',
    ...overrides,
  };
}

test('CostOptimizationService.recordCost throws on empty decisionRef', () => {
  const service = new CostOptimizationService();

  assert.throws(
    () => service.recordCost(makeCostRecord({ decisionRef: '   ' })),
    /cost_optimizer.unsourced_record/,
  );
});

test('CostOptimizationService.recordCost stores valid record', () => {
  const service = new CostOptimizationService();
  const record = makeCostRecord({ decisionRef: 'dec-001' });

  const stored = service.recordCost(record);

  assert.deepEqual(stored, record);
  assert.equal(service.listRecords().length, 1);
});

test('CostOptimizationService.recordCost increments unsourced count', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ decisionRef: 'dec-001' }));
  try {
    service.recordCost(makeCostRecord({ decisionRef: '  ' }));
  } catch {
    // expected
  }

  const dash = service.buildDashboardSlice();
  assert.equal(dash.unsourcedRecordCount, 1);
});

test('CostOptimizationService.aggregate sums correctly', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectId: 'task-001', amountUsd: 1.0 }));
  service.recordCost(makeCostRecord({ subjectId: 'task-001', amountUsd: 2.0 }));
  service.recordCost(makeCostRecord({ subjectId: 'task-002', amountUsd: 3.0 }));

  const aggregated = service.aggregate();

  assert.equal(aggregated['task-001'], 3.0);
  assert.equal(aggregated['task-002'], 3.0);
});

test('CostOptimizationService.aggregate filters by subjectType', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectType: 'task', subjectId: 'task-1' }));
  service.recordCost(makeCostRecord({ subjectType: 'model', subjectId: 'model-1' }));

  const aggregated = service.aggregate('task');

  assert.ok('task-1' in aggregated);
  assert.ok(!('model-1' in aggregated));
});

test('CostOptimizationService.buildRecommendations generates recommendations', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectId: 'task-001', amountUsd: 150.0 }));

  const recommendations = service.buildRecommendations();

  assert.ok(recommendations.length > 0);
  assert.ok(recommendations[0].estimatedSavingsUsd > 0);
});

test('CostOptimizationService.buildRecommendations does not recommend for low cost', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectId: 'task-001', amountUsd: 5.0 })); // below $10 threshold

  const recommendations = service.buildRecommendations();

  assert.equal(recommendations.length, 0);
});

test('CostOptimizationService.buildRecommendations adjusts risk for model LLM costs', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectType: 'model', costType: 'llm', subjectId: 'model-1', amountUsd: 100.0 }));

  const recommendations = service.buildRecommendations('model');

  if (recommendations.length > 0) {
    const rec = recommendations[0];
    // risk should be escalated (medium -> medium stays medium, low -> medium)
    assert.ok(rec.riskLevel === 'medium' || rec.riskLevel === 'high');
  }
});

test('CostOptimizationService.simulate calculates delta correctly', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectId: 'task-001', amountUsd: 100.0 }));

  const results = service.simulate([{
    scenarioId: 'sc-1',
    subjectId: 'task-001',
    reductionPercent: 20,
  }]);

  assert.equal(results.length, 1);
  assert.equal(results[0].currentCostUsd, 100.0);
  assert.equal(results[0].simulatedCostUsd, 80.0);
  assert.equal(results[0].deltaUsd, -20.0);
});

test('CostOptimizationService.simulate handles missing subject', () => {
  const service = new CostOptimizationService();

  const results = service.simulate([{
    scenarioId: 'sc-1',
    subjectId: 'nonexistent',
    reductionPercent: 10,
  }]);

  assert.equal(results[0].currentCostUsd, 0);
  assert.equal(results[0].simulatedCostUsd, 0);
});

test('CostOptimizationService.buildDashboardSlice includes all fields', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({ subjectId: 'task-001', amountUsd: 50.0 }));

  const dash = service.buildDashboardSlice();

  assert.ok(dash.generatedAt.length > 0);
  assert.equal(dash.totalCostUsd, 50.0);
  assert.ok('task-001' in dash.bySubject);
  assert.ok(Array.isArray(dash.recommendations));
  assert.equal(dash.unsourcedRecordCount, 0);
});

test('CostOptimizationService.listRecords returns copy', () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord());

  const records = service.listRecords();

  records.push(makeCostRecord()); // modifying returned array shouldn't affect service
  assert.equal(service.listRecords().length, 1);
});

test('aggregateCostAttribution sums by subjectId', () => {
  const entries = [
    { subjectId: 'task-001', amountUsd: 1.5 },
    { subjectId: 'task-001', amountUsd: 2.5 },
    { subjectId: 'task-002', amountUsd: 3.0 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result['task-001'], 4.0);
  assert.equal(result['task-002'], 3.0);
});

test('aggregateCostAttribution handles floating point correctly', () => {
  const entries = [
    { subjectId: 'task-001', amountUsd: 0.1 },
    { subjectId: 'task-001', amountUsd: 0.2 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result['task-001'], 0.3);
});

test('buildCostOptimizationRecommendation returns null for low cost', () => {
  const result = buildCostOptimizationRecommendation('task-001', 5.0);

  assert.equal(result, null);
});

test('buildCostOptimizationRecommendation suggests downgrade for high cost with cheaper peer', () => {
  const result = buildCostOptimizationRecommendation('task-001', 200.0, {
    modelRef: 'anthropic/claude-3-5-sonnet',
  });

  assert.ok(result != null);
  assert.equal(result!.action, 'downgrade_model');
  assert.ok(result!.recommendedModelRef != null);
});

test('buildCostOptimizationRecommendation suggests right_size for high cost without downgrade path', () => {
  const result = buildCostOptimizationRecommendation('task-001', 50.0, {
    modelRef: 'unknown-model',
  });

  assert.ok(result != null);
  assert.equal(result!.action, 'right_size');
});

test('buildCostOptimizationRecommendation suggests increase_cache_hit for low cost', () => {
  const result = buildCostOptimizationRecommendation('task-001', 15.0);

  assert.ok(result != null);
  assert.equal(result!.action, 'increase_cache_hit');
});

test('prioritizeCostOptimizationRecommendations sorts by savings descending', () => {
  const recommendations = [
    { recommendationId: 'r1', subjectId: 's1', estimatedSavingsUsd: 10, riskLevel: 'low' as const, action: 'right_size' as const },
    { recommendationId: 'r2', subjectId: 's2', estimatedSavingsUsd: 100, riskLevel: 'low' as const, action: 'right_size' as const },
    { recommendationId: 'r3', subjectId: 's3', estimatedSavingsUsd: 50, riskLevel: 'low' as const, action: 'right_size' as const },
  ];

  const sorted = prioritizeCostOptimizationRecommendations(recommendations);

  assert.equal(sorted[0].subjectId, 's2'); // 100
  assert.equal(sorted[1].subjectId, 's3'); // 50
  assert.equal(sorted[2].subjectId, 's1'); // 10
});

test('simulateCostOptimization calculates correctly', () => {
  assert.equal(simulateCostOptimization(100, 20), 80);
  assert.equal(simulateCostOptimization(50, 10), 45);
  assert.equal(simulateCostOptimization(100, 100), 0);
});

test('simulateScenarioSavings calculates correctly', () => {
  const scenarios = [
    { scenarioId: 'sc-1', baselineCostUsd: 100, reductionPercent: 20 },
    { scenarioId: 'sc-2', baselineCostUsd: 200, reductionPercent: 15 },
  ];

  const savings = simulateScenarioSavings(scenarios);

  assert.equal(savings['sc-1'], 20);
  assert.equal(savings['sc-2'], 30);
});