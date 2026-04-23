export interface BenchmarkInventoryRecord {
    readonly benchmarkId: string;
    readonly architectureSection: string;
    readonly category: "performance" | "stable_rehearsal" | "quality_gate";
    readonly command: string;
    readonly targetScale: "S1" | "S2" | "S3" | "S4_contract_only";
    readonly evidenceArtifact: string;
    readonly readinessSurface: string;
}
export declare class BenchmarkInventoryService {
    listBenchmarks(): BenchmarkInventoryRecord[];
    buildSummary(): {
        total: number;
        bySection: Record<string, number>;
        byTargetScale: Record<BenchmarkInventoryRecord["targetScale"], number>;
    };
}
