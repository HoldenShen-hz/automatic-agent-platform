const DEFAULT_BENCHMARKS = [
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
];
export class BenchmarkInventoryService {
    listBenchmarks() {
        return [...DEFAULT_BENCHMARKS];
    }
    buildSummary() {
        const benchmarks = this.listBenchmarks();
        return {
            total: benchmarks.length,
            bySection: benchmarks.reduce((summary, record) => {
                summary[record.architectureSection] = (summary[record.architectureSection] ?? 0) + 1;
                return summary;
            }, {}),
            byTargetScale: benchmarks.reduce((summary, record) => {
                summary[record.targetScale] = (summary[record.targetScale] ?? 0) + 1;
                return summary;
            }, {
                S1: 0,
                S2: 0,
                S3: 0,
                S4_contract_only: 0,
            }),
        };
    }
}
//# sourceMappingURL=benchmark-inventory-service.js.map