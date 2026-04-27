export interface BenchmarkInventoryRecord {
  readonly benchmarkId: string;
  readonly architectureSection: string;
  readonly category: "performance" | "stable_rehearsal" | "quality_gate";
  readonly command: string;
  readonly targetScale: "S1" | "S2" | "S3" | "S4_contract_only";
  readonly evidenceArtifact: string;
  readonly readinessSurface: string;
}

const DEFAULT_BENCHMARKS: readonly BenchmarkInventoryRecord[] = [
  {
    benchmarkId: "bench.runtime.validator",
    architectureSection: "§27",
    category: "quality_gate",
    command: "npm run validate:stable",
    targetScale: "S1",
    evidenceArtifact: "stable-runtime-validator",
    readinessSurface: "runtime_baseline",
  },
  {
    benchmarkId: "bench.dispatch.rehearsal",
    architectureSection: "§27",
    category: "stable_rehearsal",
    command: "npm run dispatch:stable",
    targetScale: "S2",
    evidenceArtifact: "stable-dispatch-rehearsal",
    readinessSurface: "dispatch_capacity",
  },
  {
    benchmarkId: "bench.event.replay",
    architectureSection: "§28",
    category: "stable_rehearsal",
    command: "npm run replay:stable",
    targetScale: "S2",
    evidenceArtifact: "stable-event-replay-rehearsal",
    readinessSurface: "event_reliability",
  },
  {
    benchmarkId: "bench.queue.delivery",
    architectureSection: "§28",
    category: "stable_rehearsal",
    command: "npm run queue:stable",
    targetScale: "S2",
    evidenceArtifact: "stable-queue-delivery-rehearsal",
    readinessSurface: "queue_delivery",
  },
  {
    benchmarkId: "bench.failover.drill",
    architectureSection: "§31",
    category: "stable_rehearsal",
    command: "npm run recovery-drill:stable",
    targetScale: "S3",
    evidenceArtifact: "stable-cross-division-recovery-drill",
    readinessSurface: "ha_dr",
  },
  {
    benchmarkId: "bench.evidence.campaign",
    architectureSection: "§32",
    category: "performance",
    command: "npm run campaign:stable",
    targetScale: "S4_contract_only",
    evidenceArtifact: "stable-evidence-campaign",
    readinessSurface: "deployment_evidence",
  },
] as const;

export class BenchmarkInventoryService {
  public listBenchmarks(): BenchmarkInventoryRecord[] {
    return Object.freeze([...DEFAULT_BENCHMARKS]) as BenchmarkInventoryRecord[];
  }

  public buildSummary(): {
    total: number;
    bySection: Record<string, number>;
    byTargetScale: Record<BenchmarkInventoryRecord["targetScale"], number>;
  } {
    const benchmarks = this.listBenchmarks();
    return {
      total: benchmarks.length,
      bySection: benchmarks.reduce<Record<string, number>>((summary, record) => {
        summary[record.architectureSection] = (summary[record.architectureSection] ?? 0) + 1;
        return summary;
      }, {}),
      byTargetScale: benchmarks.reduce<Record<BenchmarkInventoryRecord["targetScale"], number>>(
        (summary, record) => {
          summary[record.targetScale] = (summary[record.targetScale] ?? 0) + 1;
          return summary;
        },
        {
          S1: 0,
          S2: 0,
          S3: 0,
          S4_contract_only: 0,
        },
      ),
    };
  }
}
