/**
 * Benchmark Runner
 *
 * Evaluates proposals against benchmark test cases to determine
 * if they should be promoted.
 */

import type { ImprovementProposal } from './proposal-engine.js';

export interface EvaluationReport {
  proposalId: string;
  benchmarkCases: number;
  successRateBefore: number;
  successRateAfter: number;
  regressionRate: number;
  avgCostDelta: number;
  avgLatencyDelta: number;
  safetyViolations: number;
  decision: 'promote' | 'reject' | 'needs_revision';
  createdAt: string;
}

export interface BenchmarkResult {
  testCaseId: string;
  success: boolean;
  costUsd: number;
  latencyMs: number;
  violations: string[];
}

export interface BenchmarkRunner {
  evaluate(proposal: ImprovementProposal): Promise<EvaluationReport>;
  runBenchmarks(proposal: ImprovementProposal): Promise<BenchmarkResult[]>;
}

export interface BenchmarkCase {
  id: string;
  taskType: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  critical?: boolean;
}

export class SimpleBenchmarkRunner implements BenchmarkRunner {
  private benchmarkCases: BenchmarkCase[] = [];

  constructor(initialCases: BenchmarkCase[] = []) {
    this.benchmarkCases = initialCases;
  }

  addBenchmarkCase(benchmarkCase: BenchmarkCase): void {
    this.benchmarkCases.push(benchmarkCase);
  }

  async evaluate(proposal: ImprovementProposal): Promise<EvaluationReport> {
    const results = await this.runBenchmarks(proposal);

    const benchmarkCases = results.length;
    const successCount = results.filter((r) => r.success).length;
    const successRateAfter = benchmarkCases > 0 ? successCount / benchmarkCases : 0;

    // Baseline assumption: 60% success rate before
    const successRateBefore = 0.60;

    const avgCostBefore = 0.30; // Baseline assumption
    const avgCostAfter = results.length > 0
      ? results.reduce((sum, r) => sum + r.costUsd, 0) / results.length
      : avgCostBefore;
    const avgCostDelta = (avgCostAfter - avgCostBefore) / avgCostBefore;

    const avgLatencyBefore = 5000; // Baseline ms
    const avgLatencyAfter = results.length > 0
      ? results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
      : avgLatencyBefore;
    const avgLatencyDelta = (avgLatencyAfter - avgLatencyBefore) / avgLatencyBefore;

    const safetyViolations = results.reduce(
      (sum, r) => sum + r.violations.length,
      0
    );

    // Regression: cases that now fail but would have passed
    const regressionRate = Math.max(0, successRateBefore - successRateAfter);

    // Decision logic
    let decision: EvaluationReport['decision'] = 'promote';

    if (regressionRate > 0.05) {
      decision = 'reject';
    } else if (safetyViolations > 0) {
      decision = 'needs_revision';
    } else if (successRateAfter < successRateBefore) {
      decision = 'needs_revision';
    }

    return {
      proposalId: proposal.id,
      benchmarkCases,
      successRateBefore,
      successRateAfter,
      regressionRate,
      avgCostDelta,
      avgLatencyDelta,
      safetyViolations,
      decision,
      createdAt: new Date().toISOString(),
    };
  }

  async runBenchmarks(proposal: ImprovementProposal): Promise<BenchmarkResult[]> {
    // Simple simulation - in reality this would run actual benchmarks
    const relevantCases = this.benchmarkCases.filter(
      (c) => this.isRelevantCase(c, proposal)
    );

    return relevantCases.map((testCase) => {
      // Simulate running test
      const random = Math.random();
      const success = random > 0.3; // 70% simulated success rate

      return {
        testCaseId: testCase.id,
        success,
        costUsd: success ? 0.25 : 0.45,
        latencyMs: success ? 4000 : 8000,
        violations: success ? [] : ['minor_issue'],
      };
    });
  }

  private isRelevantCase(testCase: BenchmarkCase, proposal: ImprovementProposal): boolean {
    const target = proposal.target.toLowerCase();
    const kind = proposal.kind.toLowerCase();

    if (kind.includes('tool') && testCase.taskType.includes('tool')) return true;
    if (kind.includes('skill') && testCase.taskType.includes('skill')) return true;
    if (kind.includes('workflow') && target.includes('workflow')) return true;

    return true; // Default: include all cases
  }
}
