export interface CrossAgentMetric {
    agentId: string;
    successRate: number;
    averageCostUsd: number;
    averageLatencyMs: number;
}
export interface CrossAgentAnalysisResult {
    bestAgentId: string | null;
    worstAgentId: string | null;
    divergenceScore: number;
    recommendation: string;
}
export declare class CrossAgentAnalyzerService {
    analyze(metrics: CrossAgentMetric[]): CrossAgentAnalysisResult;
}
