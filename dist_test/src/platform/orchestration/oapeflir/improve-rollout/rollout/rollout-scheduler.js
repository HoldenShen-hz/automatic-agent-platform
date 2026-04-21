import { PolicyRolloutService } from "../policy-rollout-service.js";
const NEXT_PROGRESSIVE_STATUS = {
    shadow: "canary_5",
    canary_5: "partial_25",
    partial_25: "partial_50",
    partial_50: "partial_75",
    partial_75: "stable",
};
const DEFAULT_MINIMUM_STAGE_DWELL_MS = {
    shadow: 5 * 60_000,
    canary_5: 15 * 60_000,
    partial_25: 15 * 60_000,
    partial_50: 15 * 60_000,
    partial_75: 15 * 60_000,
};
export class RolloutScheduler {
    rolloutService;
    metricsProvider;
    now;
    minimumStageDwellMs;
    constructor(options = {}) {
        this.rolloutService = options.rolloutService ?? new PolicyRolloutService();
        this.metricsProvider = options.metricsProvider ?? null;
        this.now = options.now ?? Date.now;
        this.minimumStageDwellMs = {
            ...DEFAULT_MINIMUM_STAGE_DWELL_MS,
            ...(options.minimumStageDwellMs ?? {}),
        };
    }
    async advance(input) {
        const nextStatus = NEXT_PROGRESSIVE_STATUS[input.record.status] ?? null;
        if (nextStatus == null) {
            return {
                action: "wait",
                record: input.record,
                nextStatus: null,
                reasonCodes: ["rollout.no_further_progression"],
                metrics: null,
            };
        }
        const minimumDwellMs = this.minimumStageDwellMs[input.record.status] ?? 0;
        if (minimumDwellMs > 0 && (this.now() - input.record.transitionedAt) < minimumDwellMs) {
            return {
                action: "wait",
                record: input.record,
                nextStatus,
                reasonCodes: ["rollout.stage_dwell_required"],
                metrics: null,
            };
        }
        const metrics = this.metricsProvider == null
            ? null
            : await this.metricsProvider.readMetrics(input.record) ?? null;
        const gate = this.rolloutService.evaluateMetricsGate(input.record, nextStatus, metrics ?? undefined);
        if (!gate.allowed) {
            if (gate.rollback && metrics) {
                return {
                    action: "rollback",
                    record: this.rolloutService.rollback(input.candidate, input.record, metrics, input.approvedBy),
                    nextStatus: "rolled_back",
                    reasonCodes: gate.reasonCodes,
                    metrics,
                };
            }
            return {
                action: "blocked",
                record: input.record,
                nextStatus,
                reasonCodes: gate.reasonCodes,
                metrics,
            };
        }
        return {
            action: "promote",
            record: this.rolloutService.promote(input.candidate, input.record, nextStatus, metrics ?? undefined, input.approvedBy),
            nextStatus,
            reasonCodes: gate.reasonCodes.length > 0 ? gate.reasonCodes : ["rollout.scheduler_advanced"],
            metrics,
        };
    }
    async advanceMany(inputs) {
        const decisions = [];
        for (const input of inputs) {
            decisions.push(await this.advance(input));
        }
        return decisions;
    }
}
//# sourceMappingURL=rollout-scheduler.js.map