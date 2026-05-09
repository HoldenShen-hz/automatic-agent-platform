import type { RolloutRecord, RolloutStatus } from "../../oapeflir/types/rollout-record.js";
import type { ImprovementCandidate } from "../improvement-candidate-registry.js";
import { PolicyRolloutService } from "../policy-rollout-service.js";
import type { RolloutMetrics } from "../auto-rollback-service.js";

export interface ScheduledRollout {
  candidate: ImprovementCandidate;
  record: RolloutRecord;
  approvedBy?: string;
}

export interface RolloutSchedulerMetricsProvider {
  readMetrics(record: RolloutRecord): Promise<RolloutMetrics | null | undefined> | RolloutMetrics | null | undefined;
}

export interface RolloutSchedulerDecision {
  action: "promote" | "rollback" | "wait" | "blocked";
  record: RolloutRecord;
  nextStatus: RolloutStatus | null;
  reasonCodes: string[];
  metrics: RolloutMetrics | null;
}

export interface RolloutSchedulerOptions {
  rolloutService?: PolicyRolloutService;
  metricsProvider?: RolloutSchedulerMetricsProvider | null;
  now?: () => number;
  minimumStageDwellMs?: Partial<Record<RolloutStatus, number>>;
}

const NEXT_PROGRESSIVE_STATUS: Readonly<Partial<Record<RolloutStatus, RolloutStatus>>> = {
  evaluation_enabled: "canary_5",
  canary_5: "partial_25",
  partial_25: "stable_75",
  stable_75: "stable_100",
  stable_100: "released",
};

const DEFAULT_MINIMUM_STAGE_DWELL_MS: Readonly<Partial<Record<RolloutStatus, number>>> = {};

export class RolloutScheduler {
  private readonly rolloutService: PolicyRolloutService;
  private readonly metricsProvider: RolloutSchedulerMetricsProvider | null;
  private readonly now: () => number;
  private readonly minimumStageDwellMs: Partial<Record<RolloutStatus, number>>;

  public constructor(options: RolloutSchedulerOptions = {}) {
    this.rolloutService = options.rolloutService ?? new PolicyRolloutService();
    this.metricsProvider = options.metricsProvider ?? null;
    this.now = options.now ?? Date.now;
    this.minimumStageDwellMs = {
      ...DEFAULT_MINIMUM_STAGE_DWELL_MS,
      ...(options.minimumStageDwellMs ?? {}),
    };
  }

  public async advance(input: ScheduledRollout): Promise<RolloutSchedulerDecision> {
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
      if (gate.rollback && metrics && input.record.status !== "evaluation_enabled") {
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
      record: this.rolloutService.promote(input.candidate, input.record, nextStatus as Exclude<RolloutStatus, "candidate_created" | "under_review" | "approved" | "rejected" | "rolled_back" | "paused">, metrics ?? undefined, input.approvedBy),
      nextStatus,
      reasonCodes: gate.reasonCodes.length > 0 ? gate.reasonCodes : ["rollout.scheduler_advanced"],
      metrics,
    };
  }

  public async advanceMany(inputs: readonly ScheduledRollout[]): Promise<RolloutSchedulerDecision[]> {
    const decisions: RolloutSchedulerDecision[] = [];
    for (const input of inputs) {
      decisions.push(await this.advance(input));
    }
    return decisions;
  }
}
