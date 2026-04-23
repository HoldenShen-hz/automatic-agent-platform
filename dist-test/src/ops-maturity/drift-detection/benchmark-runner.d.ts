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
export declare class SimpleBenchmarkRunner implements BenchmarkRunner {
    private benchmarkCases;
    constructor(initialCases?: BenchmarkCase[]);
    addBenchmarkCase(benchmarkCase: BenchmarkCase): void;
    evaluate(proposal: ImprovementProposal): Promise<EvaluationReport>;
    runBenchmarks(proposal: ImprovementProposal): Promise<BenchmarkResult[]>;
    private isRelevantCase;
}
